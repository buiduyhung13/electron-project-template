import React from 'react';
const electron = window.require('electron');
const {ipcRenderer} = electron
const config = new (window.require('electron-config'))();

class Update extends React.Component {
    constructor() {
        super();
        this.state = {
            appInfo: config.get("electron.appInfo"),
            updateInfo: ""
        }

        ipcRenderer.on('update-info', (event, data) => {
            this.setState({
                updateInfo: data
            });
        })
    }

    render() {
        var {version, author} = this.state.appInfo;
        var updateInfo = this.state.updateInfo;
        return (
            <div>
              <table>
                <tbody>
                  <tr>
                    <th>New version:</th>
                    <td>
                      { version }
                    </td>
                  </tr>
                  <tr>
                    <th>Current version:</th>
                    <td>
                      { version }
                    </td>
                  </tr>
                  <tr>
                    <th>Name:</th>
                    <td>
                      { author.name }
                    </td>
                  </tr>
                  <tr>
                    <th>Email:</th>
                    <td>
                      { author.email }
                    </td>
                  </tr>
                  <tr>
                    <th>Status:</th>
                    <td>
                      { updateInfo }
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            );
    }

    componentDidMount() {
        this.setState({
            someKey: 'otherValue'
        });
    }
}

export default Update;
