import React from 'react'
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { FormGroup, InputGroup, Intent, Button, FileInput, HTMLSelect, ProgressBar, Classes, Icon   } from "@blueprintjs/core";
import { VENDOR_CM_FORMSTS, VENDOR_PARSERS } from './VendorCM.js'
import Timer from './Timer';
import { saveCMParsingFolders } from './cm-actions';

const { remote, ipcRenderer} = window.require("electron")
const { app, process, shell } = window.require('electron').remote;
const { spawn } = window.require('child_process') 
const path = window.require('path')
const isDev = window.require('electron-is-dev');
const replace = window.require('replace-in-file');
const fs = window.require('fs');
const log = window.require('electron-log');

class ProcessCMDumps extends React.Component {
        
     static icon = "asterisk";
     static label = "Process CM Dumps"
	 
	constructor(props){
		super(props);
		
		this.state = {
			outputFolderText: this.props.inputFolder === null ? "Choose folder..." : this.props.inputFolder,
			inputFileText: this.props.outputFolder === null ? "Choose folder..." : this.props.outputFolder,
			vendors: ['ERICSSON', 'HUAWEI', 'ZTE', 'NOKIA'],
			currentVendor: 'ERICSSON',
			currentFormat: 'BULKCM',
			processing: false,
			errorMessage: null,
			successMessage: null,
			infoMessage: null
			
		}
		
		this.vendorFormats = VENDOR_CM_FORMSTS
		
		this.processDumps = this.processDumps.bind(this)
		this.dismissErrorMessage = this.dismissErrorMessage.bind(this)
		this.dismissSuccessMessage = this.dismissSuccessMessage.bind(this)
		this.areFormInputsValid = this.areFormInputsValid.bind(this)
		
		this.clearForm = this.clearForm.bind(this)
		this.launchFolderExplorer = this.launchFolderExplorer.bind(this)
		
		this.currentTimerValue = "00:00:00"
		
	}
	
	onOutputFolderInputChange = (e) => {
		this.setState({outputFolderText: e.target.files[0].path})
	}
	
	onInputFileChange = (e) => {
		this.setState({inputFileText: e.target.files[0].path})
	}
	
	onVendorFormatSelectChange =(e) => {
		this.setState({currentFormat: e.target.value })
	}

	onVendorSelectChange =(e) => {
		this.setState(
		{	currentVendor: e.target.value, 
			currentFormat: VENDOR_CM_FORMSTS[e.target.value][0]}
		)
	}
	
	/**
	* Validate the inputs from the form
	*/
	areFormInputsValid = () => {
		if(this.state.inputFileText === null || this.state.inputFileText === "Choose folder..."){
			this.setState({errorMessage: "Input folder is required"})
			return false
		}

		if(this.state.outputFolderText === null || this.state.outputFolderText === "Choose folder..."){
			this.setState({errorMessage: "Output folder is required"})
			return false
		}
		
		return true
	}
	
	
	processDumps = () => {
		
		//Save the input and output folders 
		this.props.dispatch(saveCMParsingFolders(this.state.inputFileText, this.state.outputFolderText))
		
		this.setState({processing: true, errorMessage: null, successMessage: null})
		const payload = {
				"vendor": this.state.currentVendor,
				"format": this.state.currentFormat,
				"inputFolder": this.state.inputFileText,
				"outputFolder": this.state.outputFolderText
			}

		ipcRenderer.send('parse-cm-request', JSON.stringify(payload))
		log.info(`[process_cm_dumps] Sending IPC message on channel parsr-cm-request to main process with payload: ${payload}`)
		
		//Wait for response
		ipcRenderer.on('parse-cm-request', (event, args) => {
			
			log.info(`[process_cm_dumps] Received message from IPC channel "parse-cm-request with message ${args}"`)	
			
			const obj = JSON.parse(args)
			if(obj.status === 'success'){
				this.setState({errorMessage: null, successMessage: obj.message, infoMessage:null, processing: false})			
			}
			
			if(obj.status === 'error'){
				this.setState({errorMessage: obj.message.toString(), successMessage: null , infoMessage:null, processing: false})					
			}
			
			if(obj.status === 'info'){
				this.setState({errorMessage: null, successMessage: null, infoMessage: obj.message})
				
			}

		})
		
		return;

	}
	
	dismissErrorMessage = () => { this.setState({errorMessage: null})}
	
	dismissSuccessMessage = () => { this.setState({successMessage: null})}
	
		
	/**
	* Launch given folder path in file explorer
	*
	* @param string folderName
	*/	
	launchFolderExplorer = (folderName) => {
		
		if (!fs.existsSync(folderName)) {
			this.setState({errorMessage: `${folderName} does not exist`})
			return;
		}
		shell.openItem(folderName)
		
	}
	
	
	updateTimerValue = (hours, minutes, seconds) => { 
		this.currentTimerValue = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}` 
	} 
	
	clearForm = () => {
		this.setState({
			processing: false,
			outputFolderText: "Choose folder...",
			inputFileText: "Choose folder...",
		});
		this.currentTimerValue = "00:00:00"
		
	}
    render(){
		
		let successNotice = null;
		if(this.state.successMessage !== null ){ 
			successNotice = (<div className="alert alert-success m-1 p-2" role="alert">{this.state.successMessage}
					<button type="button" className="close"  aria-label="Close" onClick={this.dismissSuccessMessage}>
					<span aria-hidden="true">&times;</span>
				</button>
			</div>)
		}
		
		
		let errorNotice = null
		if(this.state.errorMessage !== null){
			errorNotice = (<div className="alert alert-danger m-1 p-2" role="alert">
						{this.state.errorMessage}
						<button type="button" className="close"  aria-label="Close" onClick={this.dismissErrorMessage}>
                            <span aria-hidden="true">&times;</span>
                        </button>
					</div>)
		}
		
		let infoNotice = null 
		if(this.state.infoMessage !== null){
			infoNotice = (<div className="alert alert-info m-1 p-2" role="alert">
				{this.state.infoMessage}
					<button type="button" className="close"  aria-label="Close" onClick={this.dismissSuccessMessage}>
					<span aria-hidden="true">&times;</span>
				</button>
			</div>) 
			
		}

		
        return (
            <div>
                <h3><FontAwesomeIcon icon="asterisk"/> Process CM Dumps</h3>

                <div className="card mb-2">
				{ this.state.processing ? (<ProgressBar intent={Intent.PRIMARY} className="mt-1"/>) : ""}
				{errorNotice}
				{successNotice}
				{infoNotice}
					
                  <div className="card-body">
                   
					<form>
					  <div className="form-group row">
						<label htmlFor="select_vendor" className="col-sm-2 col-form-label">Vendor</label>
						<div className="col-sm-10">
						  <HTMLSelect options={this.state.vendors} id="select_vendor" value={this.state.currentVendor} onChange={this.onVendorSelectChange}/>
						</div>
					  </div>
					  <div className="form-group row">
						<label htmlFor="select_file_format" className="col-sm-2 col-form-label">Format</label>
						<div className="col-sm-10">
						  <HTMLSelect id="select_file_format"options={VENDOR_CM_FORMSTS[this.state.currentVendor]} value={this.state.currentFormat} onChange={this.onVendorFormatSelectChange}/>
						</div>
					  </div>
					  <div className="form-group row">
						<label htmlFor="input_folder" className="col-sm-2 col-form-label">Input folder</label>
						<div className="col-sm-8">
						  <FileInput className="form-control" text={this.state.inputFileText} onInputChange={this.onInputFileChange} inputProps={{webkitdirectory:"", mozdirectory:"", odirectory:"", directory:"", msdirectory:""}}/>
						</div>
						<div className="col-sm-2">
							<Button icon="folder-open" text="" minimal={true} onClick={(e) => this.launchFolderExplorer(this.state.inputFileText)}/>
						</div>
					  </div>
					  <div className="form-group row">
						<label htmlFor="input_folder" className="col-sm-2 col-form-label">Output folder</label>
						<div className="col-sm-8">
						  <FileInput className="form-control" text={this.state.outputFolderText} inputProps={{webkitdirectory:"", mozdirectory:"", odirectory:"", directory:"", msdirectory:""}} onInputChange={this.onOutputFolderInputChange}/>
						</div>
						<div className="col-sm-2">
							<Button icon="folder-open" text="" minimal={true} onClick={(e) => this.launchFolderExplorer(this.state.outputFolderText)}/>
						</div>
					  </div>
					  
					  <div className="form-group row">
						<label htmlFor="input_folder" className="col-sm-2 col-form-label"></label>
						<div className="col-sm-10">
							<Timer className={"bp3-button"} visible={this.state.processing} onChange={this.updateTimerValue.bind(this)}/>  {this.state.processing? "" : <Button text={this.currentTimerValue}/>}
						</div>
					  </div>
					  
					</form>
					
					
                  </div>
				  
                </div>
				
                    <Button icon="play" text="Process" className={Classes.INTENT_PRIMARY}  onClick={this.processDumps} disabled={this.state.processing}/> &nbsp;
					<Button text="Clear" onClick={this.clearForm} disabled={this.state.processing}/>
            </div>    
        );
    }
}

function mapStateToProps(state) {
  return {
    inputFolder: state.cm.parse_cm.inputFolder,
    outputFolder: state.cm.parse_cm.outputFolder
  }
}

export default connect(mapStateToProps)(ProcessCMDumps);