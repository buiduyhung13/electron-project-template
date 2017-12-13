import React from 'react';
import { Segment, Button, Container, Header, Table, Label } from 'semantic-ui-react'
import './../../stylesheets/App.css';
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
var csv = require("fast-csv");

let childWindow;
let mainWindow;

const NO_DATA = "[no data]";
const propertyGuru = require('./../../app/constants/propertyGuru'),
  BASE_URL = propertyGuru.PROPERTY_GURU

class GetAllCondoProperty extends React.Component {
  constructor() {
    super();
    this.state = {
      loading: false,
      scrapStartAt: "",
      totalProperty: [],
      propertySucceed: [],
      propertyFailed: [],
      totalProject: [],
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
      var data = await readUserInput(filePath)
    }

    // var outputFile = generateOutput(app);
    // var writer = csvWriter({
    //   sendHeaders: true
    // });
    // writer.pipe(fs.createWriteStream(outputFile));
    // var startAt = moment();
    // this.setState({
    //   scrapStartAt: startAt.format("hh:mm:ss.SSS"),
    //   loading: true,
    // });

    // const scrapLinkDuration = 30000;
    // const projectURL = "26-newton-21156";

    // var scrapData = () => {
    //   return new Promise((resolve, reject) => {
    //     var totalPropertyItems = [];
    //     var page = 1;
    //     var itemPerPage = 500;

    //     var fn = async() => {
    //       page++;
    //       var cookies = await getCookies();
    //       var searchResultPage = await this.makeCondoPropertyRequest(page, itemPerPage, projectURL, cookies);
    //       this.state.totalRequest = this.state.totalRequest + 1;

    //       var searchResults = await this.writeCondoPropertyData(page, searchResultPage, writer);

    //       totalPropertyItems = totalPropertyItems.concat(searchResults.results);
    //       var lastPage = searchResults.lastPage;
    //       if (lastPage) {
    //         clearInterval(runInterval);
    //         resolve(totalPropertyItems);
    //       }

    //     }

    //     fn();

    //     var runInterval = setInterval(fn, scrapLinkDuration);

    //   });
    // }

    // var totalPropertyItems = await scrapData();
    // this.setState({
    //   totalProperty: totalPropertyItems
    // });

    // writer.end();

  // var completeAt = moment() - startAt;
  // this.setState({
  //   currentState: `Scrap completed after ${completeAt/1000}s`,
  //   scrapEndAt: moment().format("hh:mm:ss.SSS"),
  //   loading: false
  // });
  }

  parsePropertyInfo = (searchPageResult, writer) => {
    return new Promise((resolve, reject) => {
      const $ = cheerio.load(searchPageResult);
      var rightInfos = $("#contactmultiform .listing_info .info2");
      var leftInfos = $("#contactmultiform .listing_info .info1");
      var totalItems = rightInfos.length;
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
            projectName: (listingInfo["projectName"] !== undefined ? listingInfo["projectName"] : NO_DATA),
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

          this.setState({
            currentState: `Scrapping ${listingInfo.projectName} (${listingInfo.listingID}) succeeds`
          });

          this.state.propertySucceed.push(VALUE);


        } catch (error) {
          console.log(`FAILED AT ${i} with error ${error}`);
          this.setState({
            currentState: `Scrapping ${listingInfo.projectName} (${listingInfo.listingID}) failed`
          });

          this.state.propertyFailed.push(VALUE);
        }
      });

      resolve();
    })
  }


  makeCondoPropertyRequest = async(page = 1, items_per_page = 10, projectURL, cookies) => {
    var condoResultPage;
    var requestURL = `https://www.propertyguru.com.sg/project-listings/${projectURL}?items_per_page=${items_per_page}`;
    if (page > 1) {
      requestURL = requestURL + "/" + page;
    }
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
      }
    } catch (error) {}

    return condoResultPage;
  }

  writeCondoPropertyData = async(page, condoResultPage, writer) => {
    var condoPropertySearchResult = {
      results: [],
      lastPage: false,
      isBlocked: false
    }

    try {
      if (condoResultPage !== undefined) {
        var condoItemSelector = "#contactmultiform .infotitle .bluelink";
        var condoBlocker = "#distilIdentificationBlock";
        var lastPage = ".pagination a:contains('Last')";
        const $ = cheerio.load(condoResultPage);
        var isBlocked = $(condoBlocker).get().length
        if (isBlocked <= 0) {
          await this.parsePropertyInfo(condoResultPage, writer);
          var isLastPage = $(lastPage).get().length
          condoPropertySearchResult.lastPage = isLastPage > 0 ? false : true;
        } else {
          condoPropertySearchResult.isBlocked = true;
        }
      }
    } catch (error) {}
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
                        <Label color='green' basic size="large">Scrap project</Label>
                      </Table.Cell>
                      <Table.Cell textAlign="center">
                        { this.state.totalProject.length }
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>
                        <Label color='green' basic size="large">Total Property</Label>
                      </Table.Cell>
                      <Table.Cell textAlign="center">
                        { this.state.propertySucceed.length }
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>
                        <Label color='green' basic size="large">Scrap succeed pages</Label>
                      </Table.Cell>
                      <Table.Cell textAlign="center">
                        { this.state.propertySucceed.length }
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>
                        <Label color='red' basic size="large">Scrap failed pages</Label>
                      </Table.Cell>
                      <Table.Cell textAlign="center">
                        { this.state.propertyFailed.length }
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>
                        <Label color='green' ribbon size="large">Complete At</Label>
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

const generateOutput = (app) => {
  var directory = app.getPath('downloads');
  var outputDir = path.join(directory, `scrap-condo_${moment().format("YYYY-MM-DD")}`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  var outputFile = path.join(outputDir, "all-condominiums-property.csv");
  return outputFile;
}

const getCookies = () => {
  return new Promise((resolve, reject) => {
    mainWindow.reload();
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
      resolve(cookiesValues.join(";"));
    });
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
    return NO_DATA
  }

}

function getFurnishing(info) {
  try {
    var data = filterAttribute(info, "floatleft top5 font10");
    data = data[0].children.filter(s => s.name === "b");
    data = data[0].children[0].data;
    return data
  } catch (error) {
    return NO_DATA
  }
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
  } catch (error) {
    return NO_DATA
  }
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
  } catch (error) {
    return NO_DATA
  }

}

function getFloorArea(info) {
  try {
    var data = filterAttribute(info, "top3");
    return data[1].children[0].data;
  } catch (error) {
    return NO_DATA
  }

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
  } catch (error) {
    return NO_DATA
  }

}

function readUserInput(filePath) {
  return new Promise((resolve, reject) => {
    csv
      .fromPath(this.state.inputFilePath)
      .on("data", function(data) {
        console.log(data);
      })
      .on("end", function() {
        resolve()
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