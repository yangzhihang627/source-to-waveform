import * as React from "react";

export interface InputProps {
    name?: String;
}

const Input: React.SFC<InputProps> = props => {
    function handleChange (evt: React.ChangeEvent) {
        const { target } = evt
        let file;
        let files = (target as any).files as FileList
        if (files.length > 0) {
            file = files[0];
            console.log(file);
        }
    }
    return <input id="source" type="file"  name="source" onChange={handleChange}></input>
}

export default Input;