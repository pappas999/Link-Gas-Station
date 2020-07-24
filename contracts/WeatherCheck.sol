pragma solidity ^0.5.13;
pragma experimental ABIEncoderV2;


//import "https://raw.githubusercontent.com/smartcontractkit/chainlink/develop/evm-contracts/src/v0.4/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.5/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.5/AggregatorInterface.sol";   


     
//import "https://raw.githubusercontent.com/smartcontractkit/chainlink/develop/evm-contracts/src/v0.4/ChainlinkClient.sol";
//import "https://raw.githubusercontent.com/smartcontractkit/chainlink/develop/evm-contracts/src/v0.5/ChainlinkClient.sol";
//import "https://github.com/smartcontractkit/chainlink/evm-contracts/src/v0.5/interfaces/AggregatorInterface.sol";
        
contract WeatherCheck is ChainlinkClient, EIP712MetaTransaction("WeatherCheck","1") {
  
  uint256 public tempResult; // Stores the answer from the Chainlink oracle
  uint256 public tempCheckCount;  // Stores the amount of times the request has been made
  address public owner; // stores the owner of the contract
  bool public resultReceived; //stores if a result has been received 
  uint public contractInvoiceValue;
   
  address constant private ORACLE = 0x4a3FBbB385b5eFEB4BC84a25AaADcD644Bd09721;
  uint256 constant private ORACLE_PAYMENT_AMOUNT = 0.108 * 1 ether;
  bytes32 constant private JOB_ID = "6e34d8df2b864393a1f6b7e38917706b" ;
 
  
  AggregatorInterface internal ethUSDPriceFeed;
  AggregatorInterface internal linkUSDPriceFeed;
  
  
  
  modifier onlyOwner() {
        require(msgSender() == owner);
     _;
    }

  constructor() public  {
        setPublicChainlinkToken();
        setChainlinkOracle(ORACLE);
        owner = msgSender();
        tempCheckCount = 0;
        ethUSDPriceFeed = AggregatorInterface(0x8468b2bDCE073A157E560AA4D9CcF6dB1DB98507);
        linkUSDPriceFeed = AggregatorInterface(0xc21c178fE75aAd2017DA25071c54462e26d8face);
        contractInvoiceValue = 0;
    }
    

    function makeRequest(string  memory city) public returns (bytes32 requestId) {
        Chainlink.Request memory req = buildChainlinkRequest(JOB_ID, address(this), this.fulfill.selector);
        req.add("q", city);
        req.add("num_of_days", "1");
        req.add("copyPath","data.weather.0.avgtempC");
        requestId = sendChainlinkRequestTo(chainlinkOracleAddress(), req, ORACLE_PAYMENT_AMOUNT);
    }

    function fulfill(bytes32 _requestId, uint256 _result)  public recordChainlinkFulfillment(_requestId) {
        resultReceived = true;
        tempResult = _result;
        tempCheckCount = tempCheckCount + 1;
    }
    
   /**
     * @dev Simple function to reset the status of the contract
     */     
    function resetResult() external {
        resultReceived = false;
        tempResult = 0;
        tempCheckCount = 0;
    }

  
   /**
     * @dev Let the contract owner withdraw any remaining LINK
     */ 
    function withdrawLink() public  onlyOwner {
        LinkTokenInterface link = LinkTokenInterface(chainlinkTokenAddress());
        require(link.transfer(msg.sender, link.balanceOf(address(this))), "Unable to transfer");
    }
    
    /**
     * @dev Get the temperature of the city currently stored in the contract
     */ 
    function getCurrentTemp() external view returns (uint) {
        return tempResult;
    } 
    
   /**
     * @dev Get the number of times temperature has been checked 
     */ 
    function getTempCheckCount() external view returns (uint) {
        return tempCheckCount;
    } 
    
  /**
   * @notice Returns the address of the LINK token
   * @dev This is the public implementation for chainlinkTokenAddress, which is
   * an internal method of the ChainlinkClient contract
   */
  function getChainlinkToken() public view returns (address) {
    return chainlinkTokenAddress();
  }
  
 /**
   * @dev This is the method called when a LINK transfer takes place to this contract. In this case we just call the function 
   * to get the external data required for the contract
   */
   
  function onTokenTransfer(address _addr, uint256 _value, bytes memory _data) public {
        makeRequest(string(_data));
   }
   
 /**
   * @dev Uses Chainlink ETHUSD & LINKUSD price feeds to calculate the $ value of transactions by this contract.
   * Loops through this contracts transactions and calculates the fee in fiat payable by the contract user
   */
  function calculateContractInvoice() external view returns (uint256) {
    //loop through each transaction of this contract, exclude outbound ERC20 transactions
    
    return contractInvoiceValue;
  }
    
   /**
     * @dev Fallback function so contrat can receive ether when required
     */ 
    function() external payable {  }
    

  
}
