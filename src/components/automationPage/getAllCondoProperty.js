import React from 'react';
import { Segment, Button, Container, Header, Table, Label } from 'semantic-ui-react'
import './../../stylesheets/App.css';
import { setTimeout } from 'timers';
const config = new (window.require('electron-config'))();
const electron = window.require('electron'),
  remote = electron.remote,
  dialog = remote.dialog,
  app = remote.app;
const request = window.require('request');
const cheerio = require('cheerio');
const csvWriter = require('csv-write-stream');
const moment = require('moment');
const fs = window.require('fs');
const path = require('path');
const _ = require('lodash');
var csv = window.require("fast-csv");
const log4js = window.require('log4js');
const logger = configLog();
let childWindow;
let mainWindow;

const NO_DATA = "[no data]";
const propertyGuru = require('./../../app/constants/propertyGuru'),
  BASE_URL = propertyGuru.PROPERTY_GURU

var LIST_IP = ["128.106.194.251", "128.106.194.252", "128.106.194.253"]

class GetAllCondoProperty extends React.Component {
  constructor() {
    super();
    this.state = {
      loading: false,
      scrapStartAt: "",
      propertySucceed: 0,
      totalProject: 0,
      projectScrappedSucceed: 0,
      projectScrappedFailed: 0,
      scrapEndAt: "",
      totalRequest: 0,
      currentScrapPage: 0,
      currentState: "Click Scrap to start scraping",
      inputFilePath: null
    }

    this.handleClick.bind(this);
  }

  handleClick = async(e) => {
    var id = e.target.id;
    switch (id) {
      case "btn-close":
        childWindow.close();
        break;
      case "btn-scrap":
        await this.doScrapJob(id);
        break;
      default:
        break;
    }
  }

  doScrapJob = async(e) => {

    var filePath = dialog.showOpenDialog(childWindow, {
      filters: [{
        name: 'csv',
        extensions: ['csv']
      }],
      title: "Select CSV data file"
    });

    if (filePath) {
      var data = await readUserInput(filePath[0]);
      if (data.length > 0) {
        this.state.totalProject = data.length;

        var outputFile = generateOutput(app);
        var succeedWriter = csvWriter({
          sendHeaders: true
        });
        var failedWriter = csvWriter({
          sendHeaders: true
        });
        succeedWriter.pipe(fs.createWriteStream(outputFile.succeedFile));
        failedWriter.pipe(fs.createWriteStream(outputFile.failedFile));

        var startAt = moment();
        this.setState({
          scrapStartAt: startAt.format("hh:mm:ss.SSS"),
          loading: true,
        });

        var sleep = (miliseconds) => {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve();
            }, miliseconds)
          })
        }

        var scrapData = (projectName, projectURL) => {
          return new Promise((resolve, reject) => {

            var itemPerPage = 1000;
            var stop = false;

            var fn = async() => {
              var lastPage = false;
              var totalPropertyItems = [];
              var page = 1;
              var reloadPage = false;
              do {
                logger.info(`start loop to get property on page ${page}`);
                var startAt = moment().unix();
                var searchResults = {}

                if (this.state.projectScrappedFailed < 5) {
                  logger.info(`Make request and parse property data`);
                  var cookies = await getCookies();
                  var searchResultPage = await this.makeCondoPropertyRequest(page, itemPerPage, projectURL, cookies);
                  if (searchResultPage) {
                    searchResults = await this.writeCondoPropertyData(page, searchResultPage, projectName, projectURL, succeedWriter, failedWriter)
                  } else {
                    searchResults = {
                      isBlocked: true
                    }
                  }
                } else {
                  logger.info(`Just skip because project failed too much ${this.state.projectScrappedFailed}`);
                  this.state.currentState = `Exceed maximum failed. Just write the failed file to re-run`;
                  searchResults.isBlocked = true;
                }

                lastPage = searchResults.lastPage;
                page++;

                if (!searchResults.isBlocked) {
                  logger.info(`Data is OK, write to file`);
                  totalPropertyItems = totalPropertyItems.concat(searchResults.results);

                  if (lastPage === true) {
                    var projectScrappedSucceed = this.state.projectScrappedSucceed + 1;
                    var propertySucceed = this.state.propertySucceed + totalPropertyItems.length;

                    logger.info(`Project: ${projectScrappedSucceed}`);
                    logger.info(`PropertySucceed: ${propertySucceed}`);

                    await this.setState({
                      projectScrappedSucceed: projectScrappedSucceed,
                      propertySucceed: propertySucceed
                    });

                  }
                } else {
                  var selection = 1;
                  logger.info(`Current failed number: ${this.state.projectScrappedFailed}`);

                  if (this.state.projectScrappedFailed <= 0) {
                    selection = await dialog.showMessageBox(childWindow, {
                      type: "question",
                      buttons: ["YES", "NO"],
                      title: 'Problem with scraping. Continue?',
                      message: "Cannot get data, might have problem with capcha, please try capcha and run again!!!"
                    });

                    logger.info(`Confirm to retry? User selects: ${selection}`);
                  }

                  if (selection === 1) {
                    logger.info(`User don't retry, just complete and write the failed file`);
                    failedWriter.write({
                      condoName: projectName,
                      condoLink: projectURL
                    });

                    var projectScrappedFailed = this.state.projectScrappedFailed + 1;
                    logger.info(`projectScrappedFailed: ${projectScrappedFailed}`);
                    this.setState({
                      projectScrappedFailed: projectScrappedFailed
                    })
                  } else {
                    lastPage = false;
                    page--;
                    logger.info(`User retry. Return to page ${page}`);
                  }
                }
                logger.info(`Complete one loop get data`);
              } while (lastPage === false)
              return totalPropertyItems;
            }

            fn()
              .then((result) => {
                logger.info(`Complete one project`);
                resolve(result);
              });
          });
        }

        for (let i = 1; i < data.length; i++) {
          var projectName = data[i].projectName
          var projectURL = data[i].projectLink;
          var propertyItems = await scrapData(projectName, projectURL);
          await sleep(500);
        }

        var completeAt = moment() - startAt;
        this.setState({
          currentState: `Scrap completed after ${completeAt/1000}s`,
          scrapEndAt: moment().format("hh:mm:ss.SSS"),
          loading: false
        });

      }
    } else {
      this.setState({
        currentState: `Cannot read data, please check again!!!`,
        loading: false
      })
    }
  }

  parsePropertyInfo = (searchPageResult, projectName, projectURL, writer) => {
    return new Promise((resolve, reject) => {
      const $ = cheerio.load(searchPageResult);
      var rightInfos = $("#contactmultiform .listing_info .info2");
      var leftInfos = $("#contactmultiform .listing_info .info1");
      var totalItems = rightInfos.length;
      var results = []
      var itemArrays = []
      for (let i = 0; i < totalItems; i++) {
        itemArrays.push(i);
      }

      itemArrays.forEach(async(i) => {
        try {
          var leftInfoData = leftInfos.get(i).children;
          var rightInfoData = rightInfos.get(i).children;
          var listingInfo = getListingInfo(leftInfos.get(i));

          var askingPrice = $(`#contactmultiform #cartdiv_${listingInfo.listingID}`)

          var VALUE = {
            projectURL: projectURL,
            projectName: projectName,
            guruProjectName: (listingInfo["projectName"] !== undefined ? listingInfo["projectName"] : NO_DATA),
            listedDate: getListedData(leftInfoData) !== NO_DATA ? getListedData(leftInfoData)["listedDate"] : NO_DATA,
            floorArea: getFloorArea(rightInfoData),
            askingPrice: getAskingPrice(askingPrice),
            listingId: (listingInfo["listingID"] !== undefined ? listingInfo["listingID"] : NO_DATA),
            agentName: getAgentName(rightInfoData),
            agentContactNumber: getAgentPhone(leftInfoData),
            askingPricePsm: getAskingPricePsm(rightInfoData),
            address: getAddress(leftInfoData),
            urlOfListing: (listingInfo["listingURL"] !== undefined ? listingInfo["listingURL"] : NO_DATA),
            noOfBedrooms: getBedRooms(rightInfoData),
            noOfBathrooms: getBathRooms(rightInfoData),
            type: getType(leftInfoData),
            furnishing: getFurnishing(rightInfoData),
            relisted: getListedData(leftInfoData) !== NO_DATA ? getListedData(leftInfoData)["relisted"] : NO_DATA
          }
          await writer.write(VALUE);
          results.push(VALUE);

        } catch (error) {
          console.log(`FAILED AT ${i} with error ${error}`);
          this.setState({
            currentState: `Scrapping ${listingInfo.projectName} (${listingInfo.listingID}) failed`
          });
        }
      });
      resolve(results);
    })
  }

  makeCondoPropertyRequest = async(page = 1, items_per_page = 10, projectURL, cookies) => {
    var condoResultPage;
    projectURL = projectURL.replace("/project/", "");
    logger.info(`GET property list with ProjectURL=${projectURL}`);
    var requestURL = `https://www.propertyguru.com.sg/project-listings/${projectURL}/${page}?items_per_page=${items_per_page}`;

    try {
      var options = {
        method: 'GET',
        url: requestURL,
        headers: {
          connection: 'keep-alive',
          cookie: cookies,
          'cache-control': 'no-cache',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36',
          'upgrade-insecure-requests': '1',
          'accept-language': 'en-US,en;q=0.9,vi;q=0.8'
        }
      };

      var resp = await callRequest(options);
      if (resp.statusCode === 200) {
        condoResultPage = resp.body;
      } else {
        logger.info(`Has problem: ${resp.statusCode}`);
        logger.info(`Current page:@[ ${condoResultPage}]`);
      }
    } catch (error) {
      logger.error(`Error when makeCondoPropertyRequest: ${error}`);
    }
    logger.info(`Return condoResultPage`);
    return condoResultPage;
  }

  writeCondoPropertyData = async(page, condoResultPage, projectName, projectURL, succeedWriter) => {
    var condoPropertySearchResult = {
      results: [],
      lastPage: false,
      isBlocked: false
    }

    try {
      if (condoResultPage !== undefined) {
        var condoItemSelector = "#contactmultiform .infotitle .bluelink";
        var condoBlocker = "#distilIdentificationBlock";
        const $ = cheerio.load(condoResultPage);
        var isBlocked = $(condoBlocker).get().length
        var lastPage = $(".resultFound .orangetext").get();

        logger.info(`Is Blocked status ${isBlocked}`);
        if (isBlocked <= 0) {
          var parsedResults = await this.parsePropertyInfo(condoResultPage, projectName, projectURL, succeedWriter);
          logger.info(`Parsed complete: ${parsedResults.length} records`);
          logger.info(`Is last page status ${lastPage}`);

          var isLastPage = lastPage === undefined || lastPage.length === 0 || (lastPage[0].children[0].data === lastPage[1].children[0].data)

          if (!isLastPage) {
            try {
              console.log(lastPage[0].children[0].data);
              console.log(lastPage[1].children[0].data);
            } catch (error) {}

          }
          condoPropertySearchResult.results = parsedResults;
          condoPropertySearchResult.lastPage = isLastPage;
        } else {
          condoPropertySearchResult.isBlocked = true;
          condoPropertySearchResult.lastPage = true
        }
      } else {
        logger.info(`condoResultPage is not defined`);
      }
    } catch (error) {
      console.log(`ERROR: ${error}`);
    }
    return condoPropertySearchResult;
  }

  render() {
    var childWindowId = config.get('main.childWindow'),
      mainWindowId = config.get('main.mainWindow');
    childWindow = remote.BrowserWindow.fromId(parseInt(childWindowId, 10));
    mainWindow = remote.BrowserWindow.fromId(parseInt(mainWindowId, 10));

    return (
      <div className="App">
        <div>
          <Segment.Group>
            <Segment inverted color="black" textAlign="center" style={ { minHeight: 30, padding: '1em 1em' } }>
              <Header>
                { "Get all data from Condominiums" }
              </Header>
            </Segment>
            <Segment loading={ this.state.loading } color="yellow" textAlign="center" style={ { minHeight: 460, maxHeight: 460, padding: '1em 1em' } }>
              <Container>
                <Table celled>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell textAlign="center" width={ "5" }>
                      </Table.HeaderCell>
                      <Table.HeaderCell textAlign="center"></Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    <Table.Row>
                      <Table.Cell>
                        <Label color='blue' ribbon size="large">Start At</Label>
                      </Table.Cell>
                      <Table.Cell textAlign="center">
                        { this.state.scrapStartAt }
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>
                        <Label color='black' basic size="large">Total project</Label>
                      </Table.Cell>
                      <Table.Cell textAlign="center">
                        { this.state.totalProject }
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>
                        <Label color='brown' basic size="medium">Project succeed</Label>
                      </Table.Cell>
                      <Table.Cell textAlign="center">
                        { this.state.projectScrappedSucceed }
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>
                        <Label color='brown' basic size="medium">Project failed</Label>
                      </Table.Cell>
                      <Table.Cell textAlign="center">
                        { this.state.projectScrappedFailed }
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>
                        <Label color='green' basic size="medium">Property Succeed</Label>
                      </Table.Cell>
                      <Table.Cell textAlign="center">
                        { this.state.propertySucceed }
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>
                        <Label color='green' ribbon size="medium">Complete At</Label>
                      </Table.Cell>
                      <Table.Cell textAlign="center">
                        { this.state.scrapEndAt }
                      </Table.Cell>
                    </Table.Row>
                  </Table.Body>
                  <Table.Footer>
                    <Table.Row>
                      <Table.HeaderCell colSpan='2' textAlign='center'>
                        { this.state.currentState }
                      </Table.HeaderCell>
                    </Table.Row>
                  </Table.Footer>
                </Table>
              </Container>
            </Segment>
            <Segment inverted color="black" textAlign="center" style={ { minHeight: 60, padding: '1em 1em' } }>
              <Button inverted color="facebook" id="btn-scrap" onClick={ this.handleClick } disabled={ this.state.loading }>Scrap</Button>
              <Button id="btn-close" onClick={ this.handleClick }>Close</Button>
            </Segment>
          </Segment.Group>
        </div>
      </div>)
  }
}

function configLog() {
  var userData = app.getPath('userData');

  log4js.configure({
    appenders: {
      out: {
        type: 'stdout',
        layout: {
          type: 'pattern',
          pattern: '%d %p [%X{where}] %m'
        }
      },
      app: {
        type: 'file',
        filename: path.join(userData, "vn-scraping.log"),
        layout: {
          type: 'pattern',
          pattern: '%d %p [%X{where}] %m'
        }
      }
    },
    categories: {
      default: {
        appenders: ['out', 'app'],
        level: 'info'
      }
    }
  });
  return log4js.getLogger();
}


const generateOutput = (app) => {
  var directory = app.getPath('downloads');
  var outputDir = path.join(directory, `scrap-condo_${moment().format("YYYY-MM-DD")}`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  var succeedFile = path.join(outputDir, `all-condominiums-property_${moment().unix()}.csv`);
  var failedFile = path.join(outputDir, `all-remains_project_${moment().unix()}.csv`);
  return {
    succeedFile: succeedFile,
    failedFile: failedFile
  };
}

const getCookies = (reloadPage) => {
  return new Promise((resolve, reject) => {
    var waitTimes = 5;

    if (reloadPage === true || reloadPage === undefined) {
      mainWindow.reload();
      logger.info('Reload page to get cookies');
    }

    var isCookiesReady = setInterval(() => {
      var isLoaded = mainWindow.webContents.isLoading();
      logger.info(`WebContents loading status ${isLoaded}`);

      if (isLoaded === false || waitTimes < 0) {
        clearInterval(isCookiesReady);
        mainWindow.webContents.session.cookies.get({
          url: 'https://www.propertyguru.com.sg'
        }, (error, cookies) => {
          var cookiesValues = [];
          try {
            for (let i = 0; i < cookies.length; i++) {
              cookiesValues.push(`${cookies[i].name}=${cookies[i].value}`);
            }

          } catch (error) {
            reject(error);
          }

          var _cookiesValues = cookiesValues.join(";");
          logger.info(`Get cookies=[${_cookiesValues}]`);
          var fakeIP = _.sample(LIST_IP);
          logger.info(`Random fake IP=[${fakeIP}]`);
          _cookiesValues = _cookiesValues.replace("128.106.194.250", fakeIP);
          logger.info(`Return cookies after fake IP=[${_cookiesValues}]`);
          resolve(_cookiesValues);
        });
        waitTimes++;
      }
    }, 1000)
  });
}

function getListingInfo(info) {
  try {
    var listingInfo = {}
    var data = info.parent.children;
    data = filterAttribute(data, "infotitle")
    data = filterAttribute(data[0].children, "bluelink");
    listingInfo["listingID"] = data[0].attribs["data-ec-tracked-item-id"];
    listingInfo["listingURL"] = data[0].attribs["href"];
    listingInfo["projectName"] = data[0].attribs["href"].split("/")[data[0].attribs["href"].split("/").length - 1]
    return listingInfo;
  } catch (err) {
    return NO_DATA
  }
}

function getAskingPrice(info) {
  try {
    var data = filterAttribute(info.get(0).children, "floatleft");
    data = data[0].children.filter(function(el) {
      if (el.attribs !== undefined) {
        return el.attribs["style"] === 'line-height:normal'
      }
    });

    data = data[1].children[0].data
    return data.replace(/\s\s+/g, ' ').trim()
  } catch (err) {}
  return NO_DATA
}

function getListedData(info) {
  try {
    var listedData = {}
    var data = filterAttribute(info, "greytext");
    data = data[0].children[0].data
    if (data.includes("Re-listed on")) {
      listedData["relisted"] = true;
      data = data.replace("Re-listed on", "").trim();
    } else {
      listedData["relisted"] = false;
      data = data.replace("Listed on", "").trim();
    }
    listedData["listedDate"] = new Date(data).getTime();

    return listedData;
  } catch (err) {
    return NO_DATA
  }
}

function getAgentPhone(info) {
  try {
    var data = filterAttribute(info, "top3");
    data = data[1].children.filter(s => s.name === "b");
    var data = data[0].children[0].data
    data = data.trim().replace("Call ", "")
    return data;
  } catch (err) {
    return NO_DATA
  }

}

function getAgentName(info) {
  try {
    var data = filterAttribute(info, "top3");
    var data = data[1].children[0].data.trim();
    data = data.replace("Marketed by ", "");
    data = data.replace("-", "");
    return data;
  } catch (err) {
    return NO_DATA
  }

}

function getAddress(info) {
  try {
    var data = filterAttribute(info, "top3");
    return data[0].children[0].data.trim()
  } catch (err) {
    return NO_DATA
  }

}

function getType(info) {
  try {
    var data = info
    data = data[1].children[0].data
    data = data.replace(/\s\s+/g, ' ').trim();
    return data;
  } catch (err) {
    console.log(err);
  }

  return NO_DATA

}

function getFurnishing(info) {
  try {
    var data = filterAttribute(info, "floatleft top5 font10");
    data = data[0].children.filter(s => s.name === "b");
    data = data[0].children[0].data;
    return data
  } catch (err) {
    console.log(err);
  }

  return NO_DATA
}

function getBedRooms(info) {
  try {
    var data = filterAttribute(info, "listing_facility")
    data = filterAttribute(data[0].children, "bedroom");
    data = data[0].attribs["title"];

    if (data !== undefined || !data.includes("Bedroom")) {
      data = data.replace(" Bedrooms", "");
      data = data.replace(" Bedroom", "");
      return data
    } else {
      return NO_DATA
    }
  } catch (err) {
    console.log(err);
  }

  return NO_DATA
}


function getBathRooms(info) {
  try {
    var data = filterAttribute(info, "listing_facility")
    data = filterAttribute(data[0].children, "bathroom");
    data = data[0].attribs["title"];

    if (data !== undefined || !data.includes("Bathroom")) {
      data = data.replace(" Bathrooms", "");
      data = data.replace(" Bathroom", "");
    } else {
      data = NO_DATA
    }
    return data
  } catch (err) {
    console.log(err);
  }

  return NO_DATA

}

function getFloorArea(info) {
  try {
    var data = filterAttribute(info, "top3");
    return data[1].children[0].data;
  } catch (err) {
    console.log(err);
  }

  return NO_DATA

}


function filterAttribute(children, className) {
  var data = children.filter(function(el) {
    if (el.attribs !== undefined) {
      return el.attribs["class"] === className
    }
  })

  return data;
}

function getAskingPricePsm(info) {
  try {
    var data = filterAttribute(info, "top3");
    return data[0].children[0].data;
  } catch (err) {
    console.log(err);
  }

  return NO_DATA

}

function readUserInput(filePath) {
  return new Promise((resolve, reject) => {
    var userData = []

    csv
      .fromPath(filePath)
      .on("data", function(data) {
        userData.push({
          projectName: data[0],
          projectLink: data[1]
        });
      })
      .on("end", function() {
        resolve(userData);
      }).on('error', function() {
      reject()
    })
  });
}

function callRequest(options) {
  return new Promise((resolve, reject) => {
    request(options, (error, response, body) => {
      if (error) {
        reject(error)
      } else {
        resolve(response);
      }
    });
  })
}

export default GetAllCondoProperty;