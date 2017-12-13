import React from 'react';
import { Segment, Button, Container, Header, Table, Label } from 'semantic-ui-react'
import './../../stylesheets/App.css';
const config = new (window.require('electron-config'))();
const electron = window.require('electron'),
  remote = electron.remote,
  app = remote.app;
const request = window.require('request');
const cheerio = require('cheerio');
const csvWriter = require('csv-write-stream');
const moment = require('moment');
const fs = window.require('fs');
const path = require('path');

let childWindow;
let mainWindow;

class GetAllCondominiums extends React.Component {
  constructor() {
    super();
    this.state = {
      loading: false,
      scrapStartAt: "",
      pageSucceed: [],
      pageFailed: [],
      scrapEndAt: "",
      currentScrapPage: 0,
      currentState: "Click Scrap to start scraping"
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
    var outputFile = generateOutput(app);
    var writer = csvWriter({
      sendHeaders: true
    });
    writer.pipe(fs.createWriteStream(outputFile));
    var startAt = moment();
    this.setState({
      scrapStartAt: startAt.format("hh:mm:ss.SSS"),
      currentScrapPage: 1
    });

    const duration = 5000;
    var page = 1;
    var scrap = async(page) => {
      this.setState({
        loading: true,
        currentState: `Scrap [${page}] start: ${moment().format("hh:mm:ss.SS")}`
      });
      var cookies = await getCookies();
      var searchResultPage = await makeCondoSearchRequest(page, cookies);
      var searchResults = await readCondoSearchResult(page, searchResultPage);
      this.setState({
        currentState: `[${page}] return ${searchResults.results.length}} records`
      });
      if (searchResults.results.length > 0) {
        var isWriteSucceed = writeToCSV(searchResults.results, writer);
        if (isWriteSucceed) {
          var currentPageSucceed = this.state.pageSucceed;
          currentPageSucceed.push(page);
          this.setState({
            currentState: `[${page}] wrote to csv successfully!!!`,
            pageSucceed: currentPageSucceed
          });
        } else {
          var currentPageFailed = this.state.pageFailed;
          currentPageFailed.push(page);
          this.setState({
            currentState: `[${page}] wrote to csv unsuccessfully!!!`,
            pageFailed: currentPageFailed
          });
        }
      } else {
        var currentPageFailed = this.state.pageFailed;
        currentPageFailed.push(page);
        this.setState({
          currentState: `[${page}] scrap failed`,
          pageFailed: currentPageFailed
        });
      }

      if (searchResults.lastPage) {
        writer.end();

        var completeAt = moment() - startAt;
        this.setState({
          currentState: `Scrap completed after ${completeAt/1000}s`,
          scrapEndAt: moment().format("hh:mm:ss.SSS"),
          loading: false
        });
      }

      return searchResults.lastPage;
    }

    await scrap(page);

    var runInterval = setInterval(async() => {
      page++;
      var lastPage = await scrap(page);
      if (lastPage) {
        clearInterval(runInterval);
      }
    }, duration);
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
                        <Label color='black' basic size="large">Current Scraping pages</Label>
                      </Table.Cell>
                      <Table.Cell textAlign="center">
                        { this.state.currentScrapPage }
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>
                        <Label color='green' basic size="large">Scrap succeed pages</Label>
                      </Table.Cell>
                      <Table.Cell textAlign="center">
                        { this.state.pageSucceed.length }
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>
                        <Label color='red' basic size="large">Scrap failed pages</Label>
                      </Table.Cell>
                      <Table.Cell textAlign="center">
                        { this.state.pageFailed.length }
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
      </div>);
  }
}

const generateOutput = (app) => {
  var directory = app.getPath('downloads');
  var outputDir = path.join(directory, `scrap-condo_${moment().format("YYYY-MM-DD")}`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  var outputFile = path.join(outputDir, "all-condominiums.csv");
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

const makeCondoSearchRequest = async(page = 1, cookies) => {
  var condoResultPage;

  try {
    var options = {
      method: 'GET',
      url: 'https://www.propertyguru.com.sg/condo-directory/search/params',
      qs: {
        searchProperty: 'true',
        tracker: '',
        smm: page,
        items_per_page: '50'
      },
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

const readCondoSearchResult = async(page, condoSearchPage) => {
  var condoSearchResult = {
    results: [],
    lastPage: false,
    isBlocked: false
  }

  try {
    if (condoSearchPage !== undefined) {
      var condoItemSelector = ".bluelink";
      var condoBlocker = "#distilIdentificationBlock";
      var lastPage = ".pagination a:contains('Last')";
      const $ = cheerio.load(condoSearchPage);
      var isBlocked = $(condoBlocker).get().length
      if (isBlocked <= 0) {
        var items = $(condoItemSelector).get();
        items.forEach((item) => {
          var link = item.attribs["href"]
          var name = item.children[0].data;
          condoSearchResult.results.push({
            searchPage: page,
            condoName: name,
            condoLink: link
          });
        });
        var isLastPage = $(lastPage).get().length
        condoSearchResult.lastPage = isLastPage > 0 ? false : true;
      } else {
        condoSearchResult.isBlocked = true;
      }
    }
  } catch (error) {}
  return condoSearchResult;
}

const writeToCSV = (data, writer) => {
  try {
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      writer.write(item);
    }
    return true;
  } catch (error) {
    return false
  }
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

export default GetAllCondominiums;
