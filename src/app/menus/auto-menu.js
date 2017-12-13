import {
    app,
    BrowserWindow,
    ipcMain
} from "electron";
const propertyGuruConst = require('./../constants/propertyGuru');

const autoMenuTemplate = {
    label: "Automation",
    submenu: [{
        label: "Get all condominiums",
        click: () => {
            ipcMain.emit('call-job', "GetAllCondominiums");
        }
    }, {
        label: "Get all condo property based on condominiums",
        click: () => {
            ipcMain.emit('call-job', "GetAllCondoProperty");
        }
    }]
};



export default autoMenuTemplate;