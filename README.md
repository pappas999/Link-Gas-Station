 <div align=”center”>

![alt](https://github.com/pappas999/Link-Gas-Station/blob/master/src/weather-check/public/github.jpg)
 </div>
 
# Description

Smart Contracts that make use of the Chainlink Decentralized Oracle network need to pay node operators in the form of LINK tokens. In addition to this, they also need to pay gas (eth) costs for all transactions against the contract that cause a state change. This means users of these Chainlinked contracts need to purchase and own both LINK & ETH to in order to use the Chainlink network, or someone needs to constantly ensure the contracts have enough LINK & ETH in them for upcoming contract interactions. Currently, many enterprises and businesses are not wanting to buy, own or hold any cryptocurrencies. This Link Gas Station design pattern demonstrates that these enterprises and businesses can actually interact and use Chainlinked Smart Contracts without needing to buy, hold or own any LINK or ETH, and let someone else provide the ETH & LINK as a service, which the company or business can then get billed in fiat on a regular basis for. To add to this, the way in which the service provider keeps track of the $ amount of ETH & LINK a contract has used is based on a combination of raw blockchain data as well as the highly secure Chainlink decentralized Price Reference feeds, which means that the $ value calculation is just as secure, reliable and immutable as the Smart Contract itself. 

# How It Works

The concet of <a href="https://github.com/ethereum/EIPs/issues/1776">Native Meta Transactions</a> has existed for some time in Ethereum. Essentially a user prepares a transaction and signs it, then instead of sending it to the blockchain (which requires gas), it is relayed to another party, who intercept the message, perform validation on it and then execute it on the blockchain on the users behalf, paying any gas fees incurred. This design pattern takes that concept and then takes it 1 step further, also allowing LINK tokens transfers and Chainlinked Smart Contract external data request calls to be included as Meta Transactions. The way it does this is thanks to the fact that the LINK token is an <a href = "https://github.com/ethereum/EIPs/issues/677">ERC677 token</a>, and not an ERC-20. The ERC677 has the transferAndCall() and onTokenTransfer() functions available to use. When the user wants to interact with a Chainlinked Smart Contract to do an external data request, they generate and sign a transaction, forward it to a relayer just like a normal ETH meta transaction, except in the case of a LINK meta-transaction, the transaction actually generated is the transferAndCall() function of the LINK token Smart Contract, transferring the required amount of LINK required for the data request to the Smart Contract. The Smart Contract then receives the LINK, and as part of ERC677 functionality, it calls the onTokenTransfer() function in the Chainlinked Smart Contract, which then calls the function in the Smart Contract that fetches the external data, passing the exact amount of LINK to the Chainlink node that just came into the contract. This all happens seamelessly in 1 transaction, and means that the Chainlinked Smart Contract doesn't need to have any ETH or LINK. So if 1 LINK token comes in as part of a LINK meta transaction, that same 1 LINK token goes out within the same transaction when the external data request is triggered.

This is a simple example demonstrating the design pattern described above. In our scenario we have a Chainlinked Smart Contract that connects to the <a href="https://honeycomb.market/">Honeycomb Market</a> World Wide Weather API, fetched the average temperature for the chosen city, and updates the Smart Contract. 

# Keeping Track of the Contract Cost

Because a third party is providing the ETH & LINK required for interacting with Chainlinked Smart Contracts, they need to keep track of exactly how much is used in each transaction, and what the price of ETH & LINK was at the time of transaction. With this information they can then calculate a running total of how much they need to invoice the contract user for. Eg if the contract has used $100 in ETH & LINK, the relayer service provider needs to be able to confidently calculate the $100 based on data on-chain, then they can add a margin (eg 10%), and bill the contract user the final amount in $.

The data required to keep track of a running $ spent total for a Chainlinked Smart Contract is the following items. Each is required per contract transaction that caused a state change:

1. Amount of ETH used per transaction. Gas Used x Gas Price. Obtained from Transaction & Transaction Receipt
2. Amount of LINK transferred to the contract. Should equal the same amount of LINK transferred out of the contract
3. Current price of ETH at time of each transaction
4. Current price of LINK at time of each transaction where LINK was transferred into the contract

The first 2 items are available on-chain as part of the Transactions & Receipts. The last 2 items are obtained using the Chainlink Decentralized Price Reference Feeds <a href= "https://feeds.chain.link/eth-usd">ETH/USD</a> and <a href= "https://feeds.chain.link/link-usd">LINK/USD</a>

Because historical Chainlink Price feeds are done at a period level which doesn't co-incide with transactions on the blockchain, what we do is for each contract interaction that uses LINK or ETH, we obtain the current values from the Price Feeds at the time of transaction, and then emit them to events on the blockchain. From here they can then simply be obtained and used in the final calculation. Because all values used for the calculation are either on-chain data or obtained from Chainlink Price Reference feeds and posted on-chain, the end user can be confident that the $ calculation is highly accurate and not prone to tampering.

# Video demo

<p align="center">
   <a target="_blank" href="https://youtu.be/irPoV6m_0nE">
    <img src="https://github.com/pappas999/Link-Gas-Station/blob/master/src/weather-check/public/youtube.png"/>
   </a>
</p>

<br/>

# Run product

#### Install dependencies

```sh
# install packages.
npm install

# compile contract
truffle complier

# migrate contract
# You can update truffle-config to migrate to ropten, or you can take the remix version of the contract (WeatherCheck-remix.sol), paste it in a new remix file, compile against 0.5.13 istanbul EVM, then deploy to ropsten.

truffle deploy --reset --network ropsten

# Once you have deployed your Chainlinked Smart Contract,you need to obtain the contract public address, and put it in the config.js files located in /src/relayer and /src/weather-check/src.

# In addition to this, in /src/relayer/keys.js you need to put in a public and private key of an account you have on ropsten that has both ETH & LINK to fund the contract interactions. This should be a different account to the one you use for interacting with the front end. For the contract interactions, use an account in metamask with 0 ETH & LINK to prove that you are executing transactions without having to own any ETH or LINK.

#  Start the relayer service
cd /src/relayer
npm install
npm start


#  Start the front end application to test the contract
# run fronted
cd /src/weather-check
npm install
npm start
```

Once the application is running it can be accessed by local URL <a href="http://localhost:3000/">http://localhost:3000/</a>
