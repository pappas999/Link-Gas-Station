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
const BigNumber = require('bignumber.js');



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
let linkEthTotal = new BigNumber(0);
let linkTotal =  new BigNumber(0);
let ethTotal =  new BigNumber(0);
let calcTotal =  new BigNumber(0);

let linkPrice = new BigNumber(0);
let ethPrice = new BigNumber(0);
const ETH = 1000000000000000000;
const linkPayment = 108000000000000000;
const RELAYER_URL = 'http://localhost:7777';


function App() {

  const [weather, setWeather] = useState("");
  const [checkCount, setNewCount] = useState("");
  const [newWeather, setNewWeather] = useState("");
  const [newCity, setNewCity] = useState("");
  const [calculatedTotal, setNewCalcTotal] = useState("");

  
  const [selectedAddress, setSelectedAddress] = useState("");

  let linkCall = "0";
  let functionSignature = "";
  
  //refresh values on screen from Contract every 60 seconds
  setInterval(function(){
							getWeatherData();
						}, 120000);  
  
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
		  getContractCost(); //refresh calculated contract $ value
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
			  
			  console.log('function signature is: ' + functionSignature);
			  
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
			  
              //post the data to the relayer
              axios.post(RELAYER_URL + '/trans', postJson, {
                headers: {
                    'Content-Type': 'application/json',
                }
              }).then((response)=>{
                console.log("TX RESULT",response.data)
                let hash = response.data.TransReceipt.transactionHash
                console.log("adding custom tx with hash",hash)
				showSuccessMessage("Transaction confirmed on chain. Hash is: " + hash);
				getWeatherData();  //refresh weather data from contract
				getContractCost(); //refresh calculated contract $ value
               
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
    const  getWeatherData = async () => {
	
	let linkUsed = new BigNumber(0);
	let ethUsed = new BigNumber(0);
	
    if (web3 && contract) {
	 
	  //Get Current Temperature in contract
      contract.methods
        .getCurrentTemp()
        .call()
        .then(function(result) {
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
    }
  };
  
   /**
    * Calculate how much $ in ETH & LINK used by contract
    */
    const  getContractCost = async () => {
	
	let linkUsed = new BigNumber(0);
	let ethUsed = new BigNumber(0);
	
    if (web3 && contract) {

		console.log('calculating contract ETH & LINK cost');
		
		linkEthTotal = new BigNumber(0);
        linkTotal = new BigNumber(0);
        ethTotal = new BigNumber(0);
        calcTotal = new BigNumber(0);
	
		//first loop through and get all LINK transfer transactions. For each one we will get the transaction hash and block, then from that the gas price & gas
		//for each one found, we increment the LINK used
		let res = await web3.eth.getPastLogs({fromBlock:'0x0',address: config.contract.address, topics: ["0xfcec3eab9d5f960da56e1e0007d265c1e5ce31a294bf9af4d5331a0be69301cb"]});
		
		for (const rec of res) {			
			let tx = await web3.eth.getTransaction(rec.transactionHash);			 
				ethPrice = new BigNumber((web3.eth.abi.decodeParameters(['int256', 'int256'], rec.data)[0]) / 100000000);
				linkPrice = new BigNumber((web3.eth.abi.decodeParameters(['int256', 'int256'], rec.data)[1]) / 100000000);
							
				//to get gas used, we need to check the tx receipt, as the tx only has the gas limit
				let txRec = await web3.eth.getTransactionReceipt(rec.transactionHash);
								
				ethUsed = new BigNumber((txRec.gasUsed * tx.gasPrice) / ETH);
				ethUsed = ethUsed.times(ethPrice);
				
				//if this event is a data request one (identified by the topic), then we also need to add a LINK request x LINKUSD price to the running total
				linkEthTotal =  linkEthTotal.plus(ethUsed);   
				console.log('new linkEthTotal: ' + linkEthTotal);
				
				//now add to the LINK total using linkUSD price
				linkUsed = new BigNumber(linkPayment/ETH);  //price of 1 request for this contract
				linkUsed = linkUsed.times(linkPrice);
				linkTotal =  linkTotal.plus(linkUsed);   
				console.log('new linkTotal: ' + linkTotal);
				console.log('finished processing LINK event');
		}
		
		//now process normal ETH transactions, captured in event topic "0xc65c4c99140b1aefce6c290f708093f4987e42cf1e3fabe5ae019c926e8bbe01"
		let ethRes = await web3.eth.getPastLogs({fromBlock:'0x0',address: config.contract.address, topics: ["0xc65c4c99140b1aefce6c290f708093f4987e42cf1e3fabe5ae019c926e8bbe01"]});
		
		for (const ethRec of ethRes) {			
			let ethTx = await web3.eth.getTransaction(ethRec.transactionHash);		 
				ethPrice = new BigNumber((web3.eth.abi.decodeParameters(['int256'], ethRec.data)[0]) / 100000000);
				
				//to get gas used, we need to check the tx receipt, as the tx only has the gas limit
				let ethTxRec = await web3.eth.getTransactionReceipt(ethRec.transactionHash);
								
				ethUsed = new BigNumber((ethTxRec.gasUsed * ethTx.gasPrice) / ETH);				
				ethUsed = ethUsed.times(ethPrice);
				ethTotal =  ethTotal.plus(ethUsed);   
				console.log('new linkTotal: ' + linkTotal);
				console.log('finished processing ETH event');
		}
		
		//Now add all 3 subotals together to get the final $ value
		calcTotal = calcTotal.plus(linkEthTotal);
		calcTotal = calcTotal.plus(linkTotal);
		calcTotal = calcTotal.plus(ethTotal).toFormat(2);

		//Reset parameters
		linkEthTotal = new BigNumber(0);
		linkTotal = new BigNumber(0);
		ethTotal = new BigNumber(0);
		
		//Refresh new calculated value to screen
		setNewCalcTotal(calcTotal);
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
			&nbsp;&nbsp;
			Calculated Total $ Amount used in LINK & ETH: &nbsp;&nbsp; 
			
			 $<input type="text" name="invoiceTotal" value= {calculatedTotal} readonly/> &nbsp;&nbsp;
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
