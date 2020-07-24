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


const express = require('express');
const app = express();
const helmet = require('helmet');

//payment amount for call to Oracle(s) for external data
const linkPayment = '108000000000000000';
const linkABI = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"},{"name":"_data","type":"bytes"}],"name":"transferAndCall","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_subtractedValue","type":"uint256"}],"name":"decreaseApproval","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_addedValue","type":"uint256"}],"name":"increaseApproval","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"remaining","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"},{"indexed":false,"name":"data","type":"bytes"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"}];	

const { config } = require("./config");
const { keys } = require("./keys");

var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(helmet());
var cors = require('cors');
app.use(cors());


let contracts;
var Web3 = require('web3');
var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider('https://ropsten.rpc.fiews.io/v1/free'));



let contract = new web3.eth.Contract(
            config.contract.abi,
            config.contract.address);
console.log('loaded contract: ' + config.contract.address);

/**
 * Generate a signed tx and send to the blockchain
 * @param linkCall
 * @param userAddress
 * @param functionSignature
 * @param r
 * @param s
 * @param v
 * @param city
 */
app.post('/trans', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  console.log("got a request: ",req.body)
  
  //store parameters to be used for transaction
  console.log('getting params');
  let linkCall = req.body.linkCall;
  console.log('linkCall:' + linkCall);
  let userAddress = req.body.userAddress;
  console.log('userAddress:' + userAddress);
  let functionSignature = req.body.functionSignature;
  console.log('functionSignature:' + functionSignature);
  let r = req.body.r;
  console.log('r:' + r);
  let s = req.body.s;
  console.log('s:' + s);  
  let v = req.body.v;
  console.log('v:' + v);
  let city = req.body.city;
  console.log('city:' + city);
	
  
  //build up and execute transaction on the blockchain
  try {
	const Web3 = require('web3');
	const Tx = require('ethereumjs-tx').Transaction;
	const Web3js = new Web3(new Web3.providers.HttpProvider('https://ropsten.rpc.fiews.io/v1/free'));

	let fromAddress = keys.keys.public;  //get public address of relayer for the transaction
	
	//depending on linkCall param, we either need to perform a normal ETH/GAS meta transaction, or we need to do a LINK meta transaction, ie transfer the required LINK 
	//so the contract calls the function to obtain external data as part of the onTokenTransfer function
	
	if (linkCall == "1") { //call LINK token transferAndCall so we can do a request to an Oracle for external data
		
		const tokenAddress = await contract.methods.getChainlinkToken().call();	
		let linkContract = new Web3js.eth.Contract(linkABI, tokenAddress, {from: fromAddress})
		
		console.log('building LINKCALL transaction for city' + city);
		
		Web3js.eth.getTransactionCount(fromAddress)
		.then((count) => {
			let rawTransaction = {
			'from': fromAddress,
			'gasPrice': Web3js.utils.toHex(200 * 1e9),
			'gasLimit': Web3js.utils.toHex(240000),
			'to': tokenAddress,
			'value': 0x0,
			'data': linkContract.methods.transferAndCall(contract.options.address, linkPayment , web3.utils.asciiToHex(city)).encodeABI(),
			'nonce': Web3js.utils.toHex(count),
			'chainId': 3
			}

			let transaction = new Tx(rawTransaction,{'chain':'ropsten'});
			console.log('signing transaction');
		
			//sign transaction using relayers private key 
			transaction.sign(Buffer.from(keys.keys.private, 'hex')); 
		
			console.log('sending signed transaction to contract:' + contract.options.address);
		
			Web3js.eth.sendSignedTransaction('0x' + transaction.serialize().toString('hex'))
			.on("transactionHash", function(hash) {
				console.log('Transaction hash is ' + hash);
			}).once("confirmation", function(confirmationNumber, receipt) {
				console.log('Transaction confirmed on chain:' + receipt);
				res.status = 200;
				res.json({TransReceipt: receipt });
				console.log("finished, sending response");
				res.send();
			});
		})
	} else if (linkCall == "0") {  //do a norma ETH meta transaction on behalf of the user
		console.log('building normal ETH meta transaction');

		//calculate gas requirements first
		let gasLimit = await contract.methods
		.executeMetaTransaction(userAddress, functionSignature, r, s, v)
		.estimateGas({ from: userAddress });
		let gasPrice = await web3.eth.getGasPrice();
		
		//generate meta transaction function call
		Web3js.eth.getTransactionCount(fromAddress)
		.then((count) => {
			let rawTransaction = {
			'from': fromAddress,
			'gasPrice': Web3js.utils.toHex(200 * 1e9),
			'gasLimit': Web3js.utils.toHex(240000),
			'to': contract.options.address,
			'value': 0x0,
			'data': contract.methods.executeMetaTransaction(userAddress, functionSignature, r, s, v).encodeABI(),
			'nonce': Web3js.utils.toHex(count),
			'chainId': 3
			}

			let transaction = new Tx(rawTransaction,{'chain':'ropsten'});
			console.log('signing transaction');
		
			//sign transaction using relayers private key 
			transaction.sign(Buffer.from(keys.keys.private, 'hex')); 
		
			console.log('sending signed ETH transaction to contract:' + contract.options.address);
		
			Web3js.eth.sendSignedTransaction('0x' + transaction.serialize().toString('hex'))
			.on("transactionHash", function(hash) {
				console.log('Transaction hash is ' + hash);
			}).once("confirmation", function(confirmationNumber, receipt) {
				console.log('Transaction confirmed on chain:' + receipt);
				res.status = 200;
				res.json({TransReceipt: receipt });
				console.log("finished, sending response");
				res.send();
			});
		})
		
	} else {
			throw ("invalid linkCall type:" + linkCall);
	}
  }
  catch (error) {
		console.log('CAUGHT ERROR: ' + error);
		res.status = 400;
		res.json({Error: error });
		console.log("processing failed, sending response");
		res.send();
  }

});

app.listen(7777);
console.log('http listening on 7777');