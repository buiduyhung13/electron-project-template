import React from 'react';

class About extends React.Component {
    constructor() {
        super();
        this.state = {
            someKey: 'This is about page'
        };
    }

    render() {
        return <p>
                 { this.state.someKey }
               </p>;
    }
}

export default About;
