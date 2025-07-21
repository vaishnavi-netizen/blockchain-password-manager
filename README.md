# 🔐 Blockchain-password-manager

A blockchain-based decentralized password management system built using **Solidity**, **React**, **Tailwind CSS**, and **Hardhat**. This project allows users to securely store, access, and sync encrypted credentials across multiple devices using **Ethereum smart contracts** and **AES encryption**.

---

## 📘 Table of Contents
1. [🧠 Project Overview](#-project-overview)
2. [🛠 System Architecture](#-system-architecture)
3. [🧩 Core Components](#-core-components)
4. [🔐 Security Implementation](#-security-implementation)
5. [🔄 User Flow](#-user-flow)
6. [⚙️ Technical Details](#-technical-details)
7. [🚀 Future Enhancements](#-future-enhancements)
8. [🧪 Functionality & Implementation](#-functionality--implementation)
9. [📈 How It Works](#-how-it-works)
10. [✨ Features & Benefits](#-features--benefits)
11. [📁 File Structure](#-file-structure)
12. [👨‍💻 Author](#-author)
13. [🧾 License](#-license)

---

## 🧠 Project Overview

AES Password Manager is a decentralized app (dApp) that enables users to **store and manage passwords securely on the Ethereum blockchain**. It uses **Solidity smart contracts** to store encrypted credentials and supports synchronization across multiple devices.

---

## 🛠 System Architecture

### 🔗 High-Level Components:
- **Smart Contract Layer**: Secure vault storage and device tracking
- **Backend Layer**: API for contract interaction and vault handling
- **Frontend Layer**: React-based UI for managing credentials
- **Browser Extension**: Integrated password manager extension

### 🧰 Tech Stack:
- **Blockchain**: Ethereum (Hardhat)
- **Contracts**: Solidity
- **Backend**: Node.js + Express
- **Frontend**: React + Tailwind CSS
- **Tools**: Web3.js, Hardhat

---

## 🧩 Core Components

### 📄 `VaultManager.sol`
Smart contract handling:
- Vault creation using CIDs
- Device registration and authentication
- Access control and synchronization tracking

### 🖥 Backend API
- REST endpoints for password CRUD operations
- Blockchain interaction
- Data validation and sanitization

### 🌐 Frontend Interface
- React-based dashboard
- Tailwind CSS styling
- Wallet connection for authentication

---

## 🔐 Security Implementation

- **AES encryption** for password data at rest
- **Smart contract access control** using Ethereum addresses
- **Audit logging** via events
- **Device-based authentication** for multi-device sync

---

## 🔄 User Flow

1. Connect wallet to register
2. Create encrypted vault
3. Add/view/edit/delete passwords
4. Add new device and sync data

---

## ⚙️ Technical Details

### 🔗 Smart Contract Logic
```solidity
mapping(address => string) private userVaultCIDs;
mapping(address => mapping(string => bool)) public userDevices;
mapping(address => string[]) public userDeviceList;
mapping(address => uint256) public lastSyncTime;
```

---

## 🚀 Future Enhancements

- 🔐 Two-factor authentication
- 📱 Mobile app version
- ☁️ Cloud backup encryption
- ⏳ Gas optimization
- 🔄 Biometric device sync

---

## 🧪 Functionality & Implementation

- Users store passwords in vaults identified by **Content Identifiers (CIDs)**
- Passwords are **encrypted with AES**
- CIDs are stored in **Ethereum smart contracts**
- Users can register new devices and sync vault data

---

## 📈 How It Works

### 🧾 Vault Creation & Access
1. User connects wallet
2. Vault CID is generated and stored on-chain
3. Passwords are encrypted and stored locally or in IPFS
4. CID points to encrypted password vault

### 📱 Multi-Device Sync
- Devices call `addDevice()` to register
- Vault updates reflected across all registered devices
- Timestamp `lastSyncTime` ensures correct sync order

---

## ✨ Features & Benefits

- ✅ Decentralized password storage
- 🔒 End-to-end AES encryption
- 🔄 Multi-device sync via blockchain
- 🌍 Cross-platform accessibility
- 📊 Audit logging for accountability

---

## 📁 File Structure

```plaintext
aes-password-manager/
├── contracts/
│   ├── VaultManager.sol
│   └── Lock.sol
├── frontend/
│   ├── extension/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── tailwind.config.js
├── scripts/
│   └── deploy.js
├── ignition/
│   └── deployments/
├── test/
│   └── Lock.js
├── hardhat.config.js
├── package.json
├── README.md
```

---

## 👨‍💻 Author

**Vaishnavi Patade**  
B.Tech Computer Engineering (AI), VIT Pune  
GitHub: [vaishnavi-netizen](https://github.com/vaishnavi-netizen)

---

## 🧾 License

This project is licensed under the **MIT License**.
