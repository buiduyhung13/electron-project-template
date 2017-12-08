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

let mainWindow = null;
let forceQuit = null;

app.on('ready', () => {
    createMainWindow();
    setApplicationMenu();
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
    openURL("Update");
// sendEventToBrowser(mainWindow, "update-info", 'Checking for update...');
});

autoUpdater.on('update-available', (info) => {
    sendEventToBrowser(mainWindow, "update-info", 'Update available.');
});

autoUpdater.on('update-not-available', (info) => {
    sendEventToBrowser(mainWindow, "update-info", 'Update not available.');
});

autoUpdater.on('error', (err) => {
    sendEventToBrowser(mainWindow, "update-info", `Error in auto-updater: ${err}. Will comeback to hompage in 10s`);

    setTimeout(() => {
        openURL("Main");
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
    setTimeout(() => {
        openURL("Main");
    }, 5000)
});

ipcMain.on('check-updates', () => {
    initAutoUpdate();
});

const initAutoUpdate = () => {
    try {
        autoUpdater.checkForUpdates();
    } catch (error) {}
}
const sendEventToBrowser = (browserWindow, eventName, eventData) => {
    browserWindow.webContents.send(eventName, eventData);
}

const openURL = (componentName) => {
    try {
        config.set("currentApp.componentName", componentName);
        mainWindow.loadURL(
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
        height: 500,
        center: true,
        resizable: false,
        show: true
    });

    openURL('main');

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
    const menus = [menuTemplate.appMenuTemplate, menuTemplate.editMenuTemplate];
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