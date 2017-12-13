import { app, BrowserWindow, Menu, dialog, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as menuTemplate from './menus';
import url from 'url';
import jetpack from "fs-jetpack";
const isDev = require('electron-is-dev');
const config = new (require('electron-config'))();
const appDir = jetpack.cwd(app.getAppPath());
const currentUserName = require('username').sync();
const path = require('path');
const propertyGuruConst = require('./constants/propertyGuru')

let mainWindow = null;
let forceQuit = null;

app.on('ready', () => {
    setApplicationMenu();
    createMainWindow();

    appInfo();
});

app.on('activate', () => {
    if (mainWindow === null) {
        createMainWindow();
    }
});

app.on('window-all-closed', () => {
    app.quit();
});

autoUpdater.on('checking-for-update', () => {
    openComponent("Update");
    sendEventToBrowser(mainWindow, "update-info", 'Checking for update...');
});

autoUpdater.on('update-available', (info) => {
    sendEventToBrowser(mainWindow, "update-info", 'Update available.');
});

autoUpdater.on('update-not-available', (info) => {
    openMainPage();

});

autoUpdater.on('error', (err) => {
    sendEventToBrowser(mainWindow, "update-info", `Error in auto-updater: ${err}. Will comeback to hompage in 10s`);

    setTimeout(() => {
        openMainPage();
    }, 10000)
});

autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + Math.round(progressObj.percent) + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';

    sendEventToBrowser(mainWindow, "update-info", log_message);
});

autoUpdater.on('update-downloaded', (info) => {
    sendEventToBrowser(mainWindow, "update-info", `Update completed!!!`);
    autoUpdater.quitAndInstall(false, true);
});

ipcMain.on('check-updates', () => {
    initAutoUpdate();
});

ipcMain.on('openURL', (url) => {
    mainWindow.loadURL(url);
});

ipcMain.on('call-job', (jobName) => {
    var childWindow = new BrowserWindow({
        width: mainWindow.width,
        height: mainWindow.height,
        center: true,
        resizable: false,
        show: true,
        parent: mainWindow,
        modal: true,
    });

    config.set('main.childWindow', childWindow.id);
    config.set('main.mainWindow', mainWindow.id);

    openComponent(childWindow, jobName);


    // var request = require("request");

    // var options = {
    //     method: 'GET',
    //     url: 'https://www.propertyguru.com.sg/condo-directory/search/params',
    //     qs: {
    //         searchProperty: 'true',
    //         tracker: '',
    //         smm: '1',
    //         items_per_page: '50'
    //     },
    //     headers: {
    //         connection: 'keep-alive',
    //         cookie: 'D_SID=128.106.194.250:wl7ei+YwUfycz9IvzY4wRHuXmZkmm6j6kd916RryM2k; PHPSESSID2=35ntm6tqio8bdq2du5ftl7lmt2; PGURU_VISITOR=669c96fe-7f22-4ee8-a137-39e5021487a4; Visitor=b3035edc-5b9a-4937-b9b7-638b58ca1cd1; SEARCH_PER_PAGE=50; _ga=GA1.3.1632085638.1513083519; _gid=GA1.3.1573028086.1513083519; _gat=1; _gat_regionalTracker=1; D_IID=CF91FF26-E576-3E1B-9C46-8057CAE877B2; D_UID=4AE27FE4-DCFB-377E-BE45-5EC7F0FD3F23; D_ZID=702202CF-3FF1-3DBC-BFE0-3DC2E3E920DC; D_ZUID=70861982-951C-3914-B51B-548A2FF942A3; D_HID=E62F251E-922D-3D56-8597-F0BFE56A0EBA; cX_S=jb3oyme2e1wvhzkg; cX_P=jahnjl33vwo756wl',
    //         'cache-control': 'no-cache',
    //         accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    //         'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36',
    //         'upgrade-insecure-requests': '1',
    //         'accept-language': 'en-US,en;q=0.9,vi;q=0.8',
    //     // 'accept-encoding': 'gzip, deflate, br'
    //     }
    // };

    // request(options, function(error, response, body) {
    //     if (error)
    //         throw new Error(error);

    //     console.log(body);
    // });

});

const openMainPage = () => {
    mainWindow.loadURL(propertyGuruConst.CONDO_DIRECTORY);
}
const initAutoUpdate = () => {
    try {
        autoUpdater.checkForUpdates();
    } catch (error) {}
}

const sendEventToBrowser = (browserWindow, eventName, eventData) => {
    try {
        browserWindow.webContents.send(eventName, eventData);
    } catch (error) {
        console.log(error)
    }

}

const openComponent = (browserWindow, componentName, title) => {
    try {
        config.set("currentApp.componentName", componentName);
        config.set("currentApp.title", title);

        browserWindow.loadURL(
            isDev ?
                'http://localhost:3000' :
                url.format({
                    pathname: path.join(__dirname, 'index.html'),
                    protocol: 'file:',
                    slashes: true,
                }));
    } catch (error) {}
}

const createMainWindow = () => {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 680,
        minWidth: 640,
        minHeight: 480,
        center: true,
        resizable: false,
        show: true
    });

    openMainPage();
    app.on('activate', () => {
        mainWindow.show();
    });

    app.on('before-quit', () => {
        forceQuit = true;
    });

    mainWindow.webContents.on('did-finish-load', () => {

        // Handle window logic properly on macOS:
        // 1. App should not terminate if window has been closed
        // 2. Click on icon in dock should re-open the window
        // 3. ⌘+Q should close the window and quit the app
        if (process.platform === 'darwin') {
            mainWindow.on('close', function(e) {
                if (!forceQuit) {
                    e.preventDefault();
                    mainWindow.hide();
                }
            });

            app.on('activate', () => {
                mainWindow.show();
            });

            app.on('before-quit', () => {
                forceQuit = true;
            });
        } else {
            mainWindow.on('closed', () => {
                mainWindow = null;
            });
        }
    });
};

const setApplicationMenu = () => {
    const menus = [menuTemplate.appMenuTemplate, menuTemplate.editMenuTemplate, menuTemplate.autoMenuTemplate];
    if (isDev) {
        menus.push(menuTemplate.devMenuTemplate);
    }
    Menu.setApplicationMenu(Menu.buildFromTemplate(menus));
};

const appInfo = () => {
    const manifest = appDir.read("package.json", "json");
    const osMap = {
        win32: "Windows",
        darwin: "macOS",
        linux: "Linux"
    };
    var author = manifest.author,
        version = manifest.version,
        os = osMap[process.platform];

    var appInfo = {
        author: author,
        version: version,
        os: os,
        currentUserName: currentUserName
    }

    config.set('electron.appInfo', appInfo);
    return appInfo
}
