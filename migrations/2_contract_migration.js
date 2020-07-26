const WeatherCheck = artifacts.require("WeatherCheck");

module.exports = function(deployer) {
  deployer.deploy(WeatherCheck);
};