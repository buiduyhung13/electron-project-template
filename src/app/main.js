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
        parent: mainWindow
    });

    config.set('main.childWindow', childWindow.id);
    config.set('main.mainWindow', mainWindow.id);

    openComponent(childWindow, jobName);


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

    mainWindow.webContents.session.clearStorageData();
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
