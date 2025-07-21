// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VaultManager {
    mapping(address => string) private userVaultCIDs;
    mapping(address => mapping(string => bool)) public userDevices;
    mapping(address => string[]) public userDeviceList;
    mapping(address => uint256) public lastSyncTime;

    event VaultCIDUpdated(address indexed user, string cid);
    event DeviceAdded(address indexed user, string deviceId, string deviceName);
    event DeviceRemoved(address indexed user, string deviceId);
    event LastSyncUpdated(address indexed user, uint256 timestamp);

    function setVaultCID(string memory cid) public {
        userVaultCIDs[msg.sender] = cid;
        lastSyncTime[msg.sender] = block.timestamp;
        emit VaultCIDUpdated(msg.sender, cid);
        emit LastSyncUpdated(msg.sender, block.timestamp);
    }
    
    function getVaultCID(address user) public view returns (string memory) {
        return userVaultCIDs[user];
    }

    function addDevice(string memory deviceId, string memory deviceName) public {
        require(!userDevices[msg.sender][deviceId], "Device already registered");
        userDevices[msg.sender][deviceId] = true;
        userDeviceList[msg.sender].push(deviceId);
        emit DeviceAdded(msg.sender, deviceId, deviceName);
    }

    function removeDevice(string memory deviceId) public {
        require(userDevices[msg.sender][deviceId], "Device not registered");
        userDevices[msg.sender][deviceId] = false;
        emit DeviceRemoved(msg.sender, deviceId);
    }

    function getDevices(address user) public view returns (string[] memory) {
        return userDeviceList[user];
    }

    function isDeviceRegistered(address user, string memory deviceId) public view returns (bool) {
        return userDevices[user][deviceId];
    }
} 

//address = 0x833f07d77956C45593f0E7341CB6ac19Ce0f0019