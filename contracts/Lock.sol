// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PasswordManager {
    struct PasswordEntry {
        string encryptedData;
    }

    mapping(address => PasswordEntry[]) public userPasswords;

    function addPassword(string memory _encryptedData) public {
        userPasswords[msg.sender].push(PasswordEntry(_encryptedData));
    }

    function getPasswords() public view returns (PasswordEntry[] memory) {
        return userPasswords[msg.sender];
    }
}
