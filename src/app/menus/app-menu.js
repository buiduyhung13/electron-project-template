import { app, BrowserWindow, ipcMain } from "electron";
import { autoUpdater } from 'electron-updater';

const appMenuTemplate = {
    label: app.getName(),
    submenu: [{
        role: 'about'
    }, {
        label: "Check for updating",
        click: () => {
            ipcMain.emit('check-updates');
        }
    }, {
        type: 'separator'
    }, {
        role: 'services',
        submenu: []
    }, {
        type: 'separator'
    }, {
        role: 'hide'
    }, {
        role: 'hideothers'
    }, {
        role: 'unhide'
    }, {
        type: 'separator'
    }, {
        role: 'quit'
    }]
};

export default appMenuTemplate;