const electron = window.require('electron'),
    remote = electron.remote,
    app = remote.app;
const path = require('path')
const speech = window.require('@google-cloud/speech');
const fs = window.require('fs');
var download = window.require('download-file');
const log4js = window.require('log4js');
var ffmpeg = window.require('fluent-ffmpeg');

const logger = configLog();

export async function byPassCaptcha(window) {

    const projectId = 'voice-to-text-189815';
    var isCaptchaResolved = false;
    try {

        const convertMp3ToFlac = (mp3Input, flacOutput) => {
            return new Promise((resolve, reject) => {
                var track = mp3Input; //your path to source file
                ffmpeg(track)
                    .audioFrequency(16000)
                    .audioBitrate("16k")
                    .audioChannels(1)
                    .on('error', function (err) {
                        console.log('An error occurred: ' + err.message);
                        reject(err.message);
                    })
                    .on('progress', function (progress) {
                        console.log('Processing: ' + progress.targetSize + ' KB converted');
                    })
                    .on('end', function () {
                        console.log('Processing finished !');
                        resolve(flacOutput);
                    })
                    .toFormat('flac')
                    .save(flacOutput); //path where you want to save your file
            })
        }

        const downloadAudioCaptcha = (url, options) => {
            return new Promise(function (resolve, reject) {
                download(url, options, function (err) {
                    if (err) {
                        reject(err)
                    }
                    resolve(true);
                })
            });
        }

        const getTextFromSound = (projectId, fileName) => {
            return new Promise(function (resolve, reject) {
                process.env.GOOGLE_APPLICATION_CREDENTIALS = "./constants/voice-to-text-01554426201b.json"
                // Creates a client
                const client = new speech.SpeechClient({projectId: projectId});

                // Reads a local audio file and converts it to base64
                const file = fs.readFileSync(fileName);
                const audioBytes = file.toString('base64');

                // The audio file's encoding, sample rate in hertz, and BCP-47 language code
                const audio = {
                    content: audioBytes
                };
                const config = {
                    encoding: 'FLAC',
                    sampleRateHertz: 16000,
                    languageCode: 'en-US'
                };
                const request = {
                    audio: audio,
                    config: config
                };

                // Detects speech in the audio file
                client
                    .recognize(request)
                    .then(data => {
                        const response = data[0];
                        const transcription = response
                            .results
                            .map(result => result.alternatives[0].transcript)
                            .join('\n');
                        console.log(`Transcription: ${transcription}`);
                        resolve(transcription);
                    })
                    .catch(err => {
                        logger.info(`Error when get text from sound: ${err}`)
                        reject(err);
                    });
            });
        }

        const switchAudioSelector = "#recaptcha_switch_audio";
        const downloadAudioSelector = "#recaptcha_audio_download";
        const responseAudioSelector = "#recaptcha_response_field";
        const completeCaptcha = "#dCF_input_complete";

        logger.info(`Wait isSwitchAudio element exists`);
        var isSwitchAudio = await waitElementExist(window, switchAudioSelector, 5000);
        logger.info(`Switch Audio button existing status=${isSwitchAudio}`);

        if (isSwitchAudio) {
            logger.info(`Click on switch button`);
            click(window, switchAudioSelector);
            await sleep(500);

            logger.info(`Wait isDownloadAudioLink element exists`);
            var isDownloadAudioLink = await waitElementExist(window, downloadAudioSelector, 5000);

            if (isDownloadAudioLink) {

                var downloadAudioLink = await getAttribute(window, downloadAudioSelector, "href");
                logger.info(downloadAudioLink);

                var options = {
                    directory: "/Users/duyhung.bui/Downloads/",
                    filename: "audio.mp3"
                }

                await downloadAudioCaptcha(downloadAudioLink, options);
                var output = await convertMp3ToFlac("/Users/duyhung.bui/Downloads/audio.mp3", "/Users/duyhung.bui/Downloads/audio.flac");
                var transcription = await getTextFromSound(projectId, output);
                logger.info(`Return transcription after analysis=${transcription}`);
                await setValue(window, responseAudioSelector, transcription);
                await sleep(500);
                click(window, completeCaptcha);
                await sleep(500);
                await waitElementNotExist(window, completeCaptcha, 5000);
                isCaptchaResolved = true;
            }

        }
    } catch (error) {
        logger.info(`Error when deal with captcha: ${error}`);
    }

    return isCaptchaResolved;

}

async function waitElementNotExist(browserWindow, selector, waitingTime) {
    var stop = false;
    var isExist = true;
    var startTime = new Date().getTime();
    var exceedTime = startTime + waitingTime;
    do
    {
        logger.info(`Check if element is exists`);
        isExist = await isElementExist(browserWindow, selector);
        if (isExist === false) {
            break;
        }
        logger.info('sleep 500ms');
        await sleep(500);
        startTime = new Date().getTime();
        logger.info(`is ${startTime} > ${exceedTime}=${startTime >= exceedTime}`);
        if (startTime > exceedTime) {
            logger.info('break');
            break;
        }
    }
    while (stop === false) 

        return isExist;
    }

async function waitElementExist(browserWindow, selector, waitingTime) {
    var stop = false;
    var isExist = false;
    var startTime = new Date().getTime();
    var exceedTime = startTime + waitingTime;
    do
    {
        logger.info(`Check if element is exists`);
        isExist = await isElementExist(browserWindow, selector);
        if (isExist === true) {
            break;
        }
        logger.info('sleep 500ms');
        await sleep(500);
        startTime = new Date().getTime();
        logger.info(`is ${startTime} > ${exceedTime}=${startTime >= exceedTime}`);
        if (startTime > exceedTime) {
            logger.info('break');
            break;
        }
    }
    while (stop === false) 

        return isExist;
    }

async function isElementExist(browserWindow, selector) {
    await waitForLoaded(browserWindow);
    var element = await browserWindow
        .webContents
        .executeJavaScript(`window.document.querySelector("${selector}");`);
    if (element === null) {
        return false;
    } else {
        return true;
    }
}

async function setAttribute(browserWindow, selector, attr, value) {
    var isElement = await isElementExist(browserWindow, selector);
    if (isElement) {
        logger.info(`set att=${selector}`)
        browserWindow
            .webContents
            .executeJavaScript(`window.document.querySelector("${selector}").setAttribute("${attr}", "${value}");`);
    }
}

async function setValue(browserWindow, selector, value) {
    var isElement = await isElementExist(browserWindow, selector);
    if (isElement) {
        logger.info(`set value for ${selector} with value=${value}`);
        browserWindow
            .webContents
            .executeJavaScript(`window.document.querySelector("${selector}").value="${value}"`);
    }
}

async function getAttribute(browserWindow, selector, attr) {
    var isElement = await isElementExist(browserWindow, selector);
    var value;

    if (isElement) {
        logger.info(`get att=${selector}`)
        value = browserWindow
            .webContents
            .executeJavaScript(`window.document.querySelector("${selector}").getAttribute("${attr}")`);
    }
    return value;
}

async function click(browserWindow, selector) {
    var isElement = await isElementExist(browserWindow, selector);
    if (isElement) {
        browserWindow
            .webContents
            .executeJavaScript(`window.document.querySelector("${selector}").click();`);
    }
}

async function waitForLoaded(browserWindow, maxWait) {
    maxWait = maxWait > 20
        ? maxWait
        : 20;
    var currentState = await browserWindow
        .webContents
        .isLoading();

    while (currentState && maxWait > 0) {
        currentState = await browserWindow
            .webContents
            .isLoading();
        sleep(500);
        maxWait--;
    }
    await logger.info(currentState);
}

function sleep(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds) {
            break;
        }
    }
}

function configLog() {
    var userData = app.getPath('userData');

    log4js.configure({
        appenders: {
            out: {
                type: 'stderr',
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
                appenders: ['app'],
                level: 'info'
            }
        }
    });
    return log4js.getLogger();
}