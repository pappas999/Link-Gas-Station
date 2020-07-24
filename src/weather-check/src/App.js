/*
The MIT License (MIT)
Copyright (c) 2020 Harry Papacharissiou.
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

import React, { useState, useEffect } from "react";
import logo from './logo.svg';
import './App.css';

import Button from "@material-ui/core/Button";
import {
  NotificationContainer,
  NotificationManager
} from "react-notifications";
import "react-notifications/lib/notifications.css";

import Web3 from "web3";
import axios from 'axios';
let sigUtil = require("eth-sig-util");
const { config } = require("./config");



const domainType = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" }
];

const metaTransactionType = [
  { name: "nonce", type: "uint256" },
  { name: "from", type: "address" },
  { name: "functionSignature", type: "bytes" }
];

let domainData = {
  name: "WeatherCheck",
  version: "1",
  verifyingContract: config.contract.address
};

let web3;
let contract;

const { LinkToken } = require('@chainlink/contracts/truffle/v0.4/LinkToken');
const RELAYER_URL = 'http://localhost:7777';


function App() {

  const [weather, setWeather] = useState("");
  const [checkCount, setNewCount] = useState("");
  const [newWeather, setNewWeather] = useState("");
  const [newCity, setNewCity] = useState("");

  
  const [selectedAddress, setSelectedAddress] = useState("");

  let linkCall = "0";
  let functionSignature = "";
  
  //refresh values on screen from Contract every 60 seconds
  setInterval(function(){
							getWeatherData();
						}, 60000);  
  
  useEffect(() => {
    async function init() {
      if (
        typeof window.ethereum !== "undefined" &&
        window.ethereum.isMetaMask
      ) {
        // Ethereum user detected
        const provider = window["ethereum"];
        await provider.enable();
        if (provider.networkVersion === "3") {  //hardcoded for ropsten
          domainData.chainId = 3;
          web3 = new Web3(provider);
			
		  //get contract details
          contract = new web3.eth.Contract(
            config.contract.abi,
            config.contract.address
          );
		  
          setSelectedAddress(provider.selectedAddress);
		  console.log("contract: " + config.contract.address);
          getWeatherData(); //refresh values on screen from Smart Contract
          provider.on("accountsChanged", function(accounts) {
            setSelectedAddress(accounts[0]);
          });
        } else {
          showErrorMessage("Please change the network in metamask to Ropsten");
        }
      } else {
        showErrorMessage("Metamask not installed");
      }
    }
    init();
  }, []);
  
  const onCityCange = event => {
    setNewCity(event.target.value);
   }; 
 
 
 const weatherCheck = async event  => {
	 linkCall = "1";
	 onSubmit();
 }
  
 const resetContract = async event  => {
	 linkCall = "0";
	 onSubmit();
 }


 /**
  * Build & Sign a transaction, then send to relayer to pay LINK/GAS and submit to blockchain
  */  
  const onSubmit = async event => {
	 console.log("in onSubmit"); 
     if (newWeather != "" && contract) {
        console.log("Sending meta transaction");
		
		//obtain values to be used in signing of transaction
        let userAddress = selectedAddress;
		console.log("user addres: " + userAddress);
        let nonce = await contract.methods.getNonce(userAddress).call();
        
		if (linkCall == "1") {
			functionSignature = contract.methods.makeRequest().encodeABI();
		} else {
			functionSignature = contract.methods.resetResult().encodeABI();
		}
        
		
		let message = {};
		//let linkCall = "0";
        message.nonce = parseInt(nonce);
        message.from = userAddress;
        message.functionSignature = functionSignature;
		
		//generate data to sign
        const dataToSign = JSON.stringify({
          types: {
            EIP712Domain: domainType,
            MetaTransaction: metaTransactionType
          },
          domain: domainData,
          primaryType: "MetaTransaction",
          message: message
        });
        console.log(domainData);
        console.log();
		
		//send signed message to metamask for approval
        web3.currentProvider.send(
          {
            jsonrpc: "2.0",
            id: 999999999999,
            method: "eth_signTypedData_v4",
            params: [userAddress, dataToSign]
          },
          function(error, response) {
            console.info('User signature is; ' +response.result);
            if (error || (response && response.error)) {
              showErrorMessage("Could not get user signature");
            } else if (response && response.result) {
			
			  //get Signature Parms from response
              let { r, s, v } = getSignatureParameters(response.result);
              console.log(userAddress);
              console.log(JSON.stringify(message));
              console.log(message);
              console.log(getSignatureParameters(response.result));

              const recovered = sigUtil.recoverTypedSignature_v4({
                data: JSON.parse(dataToSign),
                sig: response.result
              });
              console.log('Recovered: ' +recovered);
			  
			  console.log('function sig is: ' + functionSignature);
			  
			  //Now build up json object to send to relayer
			  //Need to check if its a LINK transaction/data request or a normal meta transaction
			 
			  
			  
             let postJson = {
                  linkCall: linkCall,
                  city: newCity,
                  userAddress: userAddress,
                  functionSignature: functionSignature,
                  r: r,
				  s: s,
				  v: v
              }
			  
              console.log("postJson: ",postJson);
			  
              //post the data to the relayer
              axios.post(RELAYER_URL + '/trans', postJson, {
                headers: {
                    'Content-Type': 'application/json',
                }
              }).then((response)=>{
                console.log("TX RESULT",response.data)
                let hash = response.data.transactionHash
                console.log("adding custom tx with hash",hash)
				showSuccessMessage("Transaction confirmed on chain. Hash is: " + hash);
				getWeatherData();
               
              });
				
			  
            }
          }
        );
      
     } else {
      showErrorMessage("Please enter the city");
     }	 
   }
   
   
 /**
  * Extract signature parameters r,s,v from Signature
  */	
  const getSignatureParameters = signature => {
     if (!web3.utils.isHexStrict(signature)) {
         throw new Error(
        'Given value "'.concat(signature, '" is not a valid hex string.'));
     }
     var r = signature.slice(0, 66);
     var s = "0x".concat(signature.slice(66, 130));
     var v = "0x".concat(signature.slice(130, 132));
     v = web3.utils.hexToNumber(v);
     if (![27, 28].includes(v)) v += 27;
		return {
		r: r,
		s: s,
		v: v
	 };
  };	
  
 /**
  * Refresh values on screen from Smart Contract
  */
  const getWeatherData = () => {
    if (web3 && contract) {
	 
	  //Get Current Temperature in contract
      contract.methods
        .getCurrentTemp()
        .call()
        .then(function(result) {
          //console.log("Temp result: " + result);
          if (
            result &&
            result != undefined 
          ) {
            if (result == "") {
              showErrorMessage("No weather data in smart contract");
            } else {
              setNewWeather(result);
            }
          } else {
            showErrorMessage("Not able to get weather information from Network");
          }
        });
		
		//Get Count of external data calls in contract
		contract.methods
        .getTempCheckCount()
        .call()
        .then(function(result) {
          //console.log("Temp Check Count: " + result);
          if (
            result &&
            result != undefined 
          ) {
            if (result == "") {
              showErrorMessage("No weather data in smart contract");
            } else {
              setNewCount(result);
            }
          } else {
            showErrorMessage("Not able to get weather information from Network");
          }
        });
		
		//Get Calculated fee payable
    }
  };
  
  const showErrorMessage = message => {
    NotificationManager.error(message, "Error", 5000);
  };

  const showSuccessMessage = message => {
    NotificationManager.success(message, "Message", 3000);
  };

  const showInfoMessage = message => {
    NotificationManager.info(message, "Info", 3000);
  };
  

  return (
   <div className="App">
      <section className="main">

	  
        <div className="mb-wrap mb-style-2">
          <img src = "project logo 1.jpg" align="center" height="35%" width="35%"/>

        </div>
      </section>
      <section>
        <div className="submit-container">
          <div className="submit-row">
		  City: &nbsp;&nbsp;   
		  <select name="City" id="city" onChange={onCityCange}  >
			<option value="Sydney">Sydney</option>
			<option value="New York">New York</option>
			<option value="London">London</option>
			<option value="Athens">Athens</option>
		</select>
            
          &nbsp;&nbsp;  <Button variant="contained" color="primary" onClick={weatherCheck}>
              Submit
            </Button> 
			<div>&nbsp;</div>
			</div>
			<div>
			Average Temperature: &nbsp;&nbsp; 
		    <input type="text" name="weather" value= {newWeather} readonly/>
			
			&nbsp;&nbsp;Chainlink data request count: &nbsp;&nbsp; 
		    <input type="text" name="dataFetchCount" value= {checkCount} readonly/>
			</div>
			<div>&nbsp;</div>
		    <div>
			<Button variant="contained" color="primary" onClick={resetContract}>
             Reset Contract
            </Button>
          </div>
        </div>
      </section>
      <NotificationContainer />
    </div>
  );
}

export default App;
