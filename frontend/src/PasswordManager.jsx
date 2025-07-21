import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import CryptoJS from 'crypto-js';
import { VAULT_MANAGER_ADDRESS } from './config';
import VaultManager from './VaultManager.json';

const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

// Session management constants
const AUTO_LOGOUT_TIMER = 15 * 60 * 1000; // 15 minutes
const WARNING_TIMER = 1 * 60 * 1000; // 1 minute warning
const MAX_SESSIONS = 3;

export default function PasswordManager() {
  // State management
  const [state, setState] = useState({
    account: '',
    password: '',
    label: '',
    platform: '',
    vault: [],
    key: '',
    provider: null,
    isIpfsInitialized: false,
    isLoading: false,
    vaultManager: null,
    error: null,
    showPassword: false,
    // Session management states
    lastActivity: Date.now(),
    showLogoutWarning: false,
    sessions: [],
    autoLogoutEnabled: true,
    autoLogoutTime: AUTO_LOGOUT_TIMER,
    warningTime: WARNING_TIMER,
    // Blockchain sync state
    lastKnownCID: null,
    syncEnabled: true,
    lastSyncTime: null
  });

  // Update state helper
  const updateState = (updates) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // Activity tracking
  useEffect(() => {
    const handleActivity = () => {
      updateState({ lastActivity: Date.now() });
    };

    // Add event listeners for user activity
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, []);

  // Auto-logout timer
  useEffect(() => {
    // If auto-logout is disabled or no account is connected, don't set up the timer
    if (!state.autoLogoutEnabled || !state.account) return;
    
    // If timer is set to "Never" (0), don't check for inactivity
    if (state.autoLogoutTime === 0) return;

    const checkInactivity = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - state.lastActivity;

      if (timeSinceLastActivity >= state.autoLogoutTime) {
        handleLogout();
      } else if (timeSinceLastActivity >= (state.autoLogoutTime - state.warningTime)) {
        updateState({ showLogoutWarning: true });
      }
    };

    const timer = setInterval(checkInactivity, 1000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lastActivity, state.autoLogoutEnabled, state.autoLogoutTime, state.warningTime, state.account]);

  // Session management
  useEffect(() => {
    if (!state.account) return;

    const updateSessions = () => {
      // Create a more detailed session identifier that includes browser info
      const browserInfo = getBrowserInfo();
      
      // Create a sessionKey that's unique to each browser instance
      const sessionKey = generateBrowserFingerprint();
      
      const newSession = {
        device: navigator.userAgent,
        browser: browserInfo.name,
        browserVersion: browserInfo.version,
        deviceType: getDeviceType(),
        lastActive: Date.now(),
        ip: '127.0.0.1', // In production, get from backend
        location: 'Local', // In production, get from IP
        id: sessionKey, // Use the fingerprint as the ID
        isCurrentBrowser: true // Mark this as the current browser
      };

      updateState(prev => {
        // Start with existing sessions, but mark all as not current browser
        let sessions = prev.sessions.map(session => ({
          ...session,
          isCurrentBrowser: false
        }));
        
        // Find if this browser already has a session
        const existingSessionIndex = sessions.findIndex(s => s.id === sessionKey);
        
        if (existingSessionIndex >= 0) {
          // Update the existing session
          sessions[existingSessionIndex] = {
            ...sessions[existingSessionIndex],
            lastActive: Date.now(),
            isCurrentBrowser: true
          };
        } else {
          // This is a new browser session
          if (sessions.length >= MAX_SESSIONS) {
            // Find the oldest session to remove
            const oldestSession = sessions.reduce((oldest, current) => 
              current.lastActive < oldest.lastActive ? current : oldest, 
              sessions[0]
            );
            
            const oldestIndex = sessions.findIndex(s => s.id === oldestSession.id);
            if (oldestIndex >= 0) {
              sessions.splice(oldestIndex, 1);
            } else {
              sessions.shift(); // Fallback - remove the first one
            }
          }
          
          // Add the new session
          sessions.push(newSession);
        }
        
        return { sessions };
      });
    };

    // Initial session update
    updateSessions();
    
    // Update session every minute
    const sessionTimer = setInterval(updateSessions, 60000);
    return () => clearInterval(sessionTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.account]);

  // Generate a unique fingerprint for this browser instance
  // This will be different across browsers but consistent within the same browser
  const generateBrowserFingerprint = () => {
    const browserInfo = getBrowserInfo();
    const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const language = navigator.language;
    
    // Combine these values to create a unique fingerprint
    const fingerprintData = [
      browserInfo.name,
      browserInfo.version,
      getDeviceType(),
      screenInfo,
      timeZone,
      language,
      // Adding a short random value that remains consistent in this browser session
      // This ensures different windows of the same browser get separate sessions
      sessionStorage.getItem('browserInstanceId') || 
        sessionStorage.setItem('browserInstanceId', Math.random().toString(36).substring(2, 10))
    ].join('|');
    
    // Create a hash of the fingerprint
    let hash = 0;
    for (let i = 0; i < fingerprintData.length; i++) {
      const char = fingerprintData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return hash.toString(36) + Date.now().toString(36).substring(4);
  };

  // Helper to detect browser name and version
  const getBrowserInfo = () => {
    const userAgent = navigator.userAgent;
    let browserName = "Unknown";
    let browserVersion = "";
    
    // Chrome
    if (userAgent.indexOf("Chrome") > -1 && userAgent.indexOf("Edg") === -1) {
      browserName = "Chrome";
      browserVersion = userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || "";
    }
    // Edge
    else if (userAgent.indexOf("Edg") > -1) {
      browserName = "Edge";
      browserVersion = userAgent.match(/Edg\/([0-9.]+)/)?.[1] || "";
    }
    // Firefox
    else if (userAgent.indexOf("Firefox") > -1) {
      browserName = "Firefox";
      browserVersion = userAgent.match(/Firefox\/([0-9.]+)/)?.[1] || "";
    }
    // Safari
    else if (userAgent.indexOf("Safari") > -1) {
      browserName = "Safari";
      browserVersion = userAgent.match(/Safari\/([0-9.]+)/)?.[1] || "";
    }
    
    return { name: browserName, version: browserVersion };
  };

  // Helper to detect device type
  const getDeviceType = () => {
    const userAgent = navigator.userAgent;
    if (/Mobi|Android/i.test(userAgent)) {
      return "Mobile";
    } else if (/iPad|Tablet/i.test(userAgent)) {
      return "Tablet";
    } else {
      return "Desktop";
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      if (state.vault.length > 0) {
        await storeVaultData();
      }
      updateState({
        account: '',
        key: '',
        vault: [],
        isIpfsInitialized: false,
        vaultManager: null,
        sessions: [],
        showLogoutWarning: false
      });
    } catch (error) {
      console.error("Logout error:", error);
      alert("Error during logout. Please try again.");
    }
  };

  // End specific session
  const endSession = (sessionId) => {
    const currentSession = state.sessions.find(s => s.id === sessionId);
    const isCurrentSession = currentSession?.isCurrentBrowser;

    if (isCurrentSession) {
      // If ending current session, log out completely
      handleLogout();
    } else {
      // If ending another session, just remove it from the list
      updateState(prev => ({
        sessions: prev.sessions.filter(session => session.id !== sessionId)
      }));
    }
  };

  // Update the session display in the UI
  const renderSessions = () => {
    return state.sessions.map(session => {
      // Use the isCurrentBrowser flag to determine if this is the current session
      const isCurrentSession = session.isCurrentBrowser;
      
      const deviceName = isCurrentSession 
        ? "This Device" 
        : `${session.browser} on ${session.deviceType}`;
      
      return (
        <div key={session.id} className="flex justify-between items-center bg-gray-700/30 p-3 rounded-lg">
          <div>
            <p className="font-medium">{deviceName}</p>
            <p className="text-sm text-gray-400">
              Last active: {new Date(session.lastActive).toLocaleString()}
            </p>
          </div>
          <button
            onClick={() => endSession(session.id)}
            className={`px-3 py-1 rounded-lg transition-colors ${
              isCurrentSession 
                ? "text-red-400 hover:text-red-300" 
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            {isCurrentSession ? "Logout" : "End Session"}
          </button>
        </div>
      );
    });
  };

  // Toggle auto-logout
  const toggleAutoLogout = () => {
    updateState(prev => ({
      autoLogoutEnabled: !prev.autoLogoutEnabled,
      showLogoutWarning: false
    }));
  };

  // Update auto-logout time
  const updateAutoLogoutTime = (minutes) => {
    // If the user selects "Never", disable auto-logout
    if (minutes === 0) {
      updateState({
        autoLogoutTime: 0,
        showLogoutWarning: false
      });
    } else {
      updateState({
        autoLogoutTime: minutes * 60 * 1000,
        showLogoutWarning: false
      });
    }
  };

  // Initialize provider
  useEffect(() => {
    if (window.ethereum) {
      const newProvider = new ethers.BrowserProvider(window.ethereum);
      updateState({ provider: newProvider });
    }
  }, []);

  // Listen for extension connection
  useEffect(() => {
    const handleExtensionMessage = (event) => {
      if (event.source !== window) return;
      
      if (event.data.type === 'EXTENSION_CONNECT') {
        setState(prev => ({
          ...prev,
          extensionConnected: true
        }));
      } else if (event.data.type === 'REQUEST_CREDENTIALS') {
        handleCredentialRequest(event.data.url);
      }
    };

    window.addEventListener('message', handleExtensionMessage);
    return () => window.removeEventListener('message', handleExtensionMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // IPFS operations
  const pinFileToIPFS = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          pinata_api_key: process.env.REACT_APP_PINATA_API_KEY,
          pinata_secret_api_key: process.env.REACT_APP_PINATA_API_SECRET,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`IPFS upload failed: ${response.status}`);
      }

      const data = await response.json();
      return data.IpfsHash;
    } catch (error) {
      console.error('IPFS upload error:', error);
      throw new Error('Failed to upload to IPFS. Please check your connection and API keys.');
    }
  };

  const unpinFromIPFS = async (cid) => {
    try {
      const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
        method: 'DELETE',
        headers: {
          pinata_api_key: process.env.REACT_APP_PINATA_API_KEY,
          pinata_secret_api_key: process.env.REACT_APP_PINATA_API_SECRET,
        },
      });

      if (!response.ok) {
        throw new Error(`IPFS unpin failed: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('IPFS unpin error:', error);
      throw new Error('Failed to remove file from IPFS.');
    }
  };

  // Vault operations
  const storeVaultData = async () => {
    try {
      // Only store if there are changes
      if (state.vault.length === 0) {
        console.log("No vault data to store");
        return null;
      }

      console.log(`Storing vault with ${state.vault.length} entries to blockchain...`);
      
      // Create a deep copy of the vault to avoid reference issues
      const vaultDataCopy = JSON.parse(JSON.stringify(state.vault));
      const vaultData = JSON.stringify(vaultDataCopy);
      console.log(`Vault data size: ${vaultData.length} characters`);
      
      const blob = new Blob([vaultData], { type: 'application/json' });
      
      // Run IPFS and contract operations in parallel
      console.log("Uploading vault to IPFS and retrieving current CID...");
      const [cid, currentCID] = await Promise.all([
        pinFileToIPFS(blob),
        state.vaultManager.getVaultCID(state.account)
      ]);
      
      console.log(`New IPFS CID: ${cid}, Current blockchain CID: ${currentCID}`);
      
      // Only update if the CID has changed
      if (cid !== currentCID) {
        console.log(`CID changed, updating blockchain from ${currentCID} to ${cid}`);
        const tx = await state.vaultManager.setVaultCID(cid);
        console.log("Transaction sent, waiting for confirmation...");
        await tx.wait();
        console.log("Transaction confirmed, blockchain updated successfully");
        
        // Update the lastKnownCID to match what's now on the blockchain
        updateState({ lastKnownCID: cid });
      } else {
        console.log("CID has not changed, no blockchain update needed");
      }
      
      return cid;
    } catch (error) {
      console.error("Vault storage error:", error);
      throw new Error('Failed to store vault data: ' + error.message);
    }
  };

  const fetchPreviousVault = async (cid) => {
    try {
      updateState({ isLoading: true });
      
      console.log(`Fetching vault from IPFS with CID: ${cid}`);
      
      const response = await fetch(`${IPFS_GATEWAY}${cid}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch vault: ${response.status}`);
      }
      
      // Get the response text first for debugging
      const responseText = await response.text();
      console.log(`Raw IPFS response: ${responseText.substring(0, 100)}...`);
      
      // Try to parse the JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Error parsing vault data:", parseError);
        throw new Error(`Failed to parse vault data: ${parseError.message}`);
      }
      
      console.log(`Fetched vault data with ${data ? data.length : 0} entries`);
      
      if (!Array.isArray(data)) {
        console.error("Fetched vault data is not an array:", data);
        throw new Error("Invalid vault data format: not an array");
      }
      
      // Create a deep copy of the current vault to avoid reference issues
      const currentVault = JSON.parse(JSON.stringify(state.vault || []));
      console.log(`Current vault has ${currentVault.length} entries`);
      
      // Merge the fetched data with existing vault using improved merging
      const mergedVault = mergeVaultsImproved(currentVault, data);
      console.log(`After merging, vault has ${mergedVault.length} entries`);
      
      // Force an immediate state update with a direct state mutation
      // This ensures the changes are applied immediately on the first pull
      // Use setState for a complete re-render
      return new Promise((resolve) => {
        setState(prevState => {
          const newState = {
            ...prevState,
            vault: mergedVault,
            lastKnownCID: cid,
            lastSyncTime: new Date().toLocaleTimeString()
          };
          
          // Use setTimeout with 0 delay to ensure the state update completes
          setTimeout(() => resolve(mergedVault), 0);
          
          return newState;
        });
      });
    } catch (error) {
      console.error("Vault fetch error:", error);
      throw new Error('Failed to load previous vault data: ' + error.message);
    } finally {
      updateState({ isLoading: false });
    }
  };

  // Improved vault merging function with better logging
  const mergeVaultsImproved = (localVault, remoteVault) => {
    console.log("Merging vaults...");
    console.log(`Local vault has ${localVault.length} entries`);
    console.log(`Remote vault has ${remoteVault.length} entries`);
    
    // When pulling from blockchain, consider the remote vault as the source of truth
    // When the sync direction is PULL, we should use the remote vault as the complete source of truth
    if (state.lastSyncTime && state.lastSyncTime.includes("Pull")) {
      console.log("This is a PULL operation - using remote vault as the source of truth");
      console.log(`Replacing local vault (${localVault.length} entries) with remote vault (${remoteVault.length} entries)`);
      
      // Create a deep copy of the remote vault to avoid reference issues
      const remoteCopy = JSON.parse(JSON.stringify(remoteVault));
      
      // Log the difference for debugging
      const localCIDs = new Set(localVault.map(entry => entry.cid));
      const remoteCIDs = new Set(remoteVault.map(entry => entry.cid));
      
      const addedEntries = remoteVault.filter(entry => !localCIDs.has(entry.cid));
      const removedEntries = localVault.filter(entry => !remoteCIDs.has(entry.cid));
      
      console.log(`Pull will add ${addedEntries.length} entries and remove ${removedEntries.length} entries`);
      
      return remoteCopy;
    }
    
    // For other operations (like automatic sync or push), use the additive merge approach
    console.log("This is a regular merge operation - adding new entries only");
    
    // Create a map of existing entries by CID for fast lookup
    const localEntries = new Map();
    localVault.forEach(entry => {
      localEntries.set(entry.cid, entry);
    });
    
    // Start with a fresh array containing all local entries
    const mergedVault = [...localVault];
    
    // Track new entries for debugging
    const newEntries = [];
    
    // Add all remote entries that don't exist locally
    remoteVault.forEach(remoteEntry => {
      if (!localEntries.has(remoteEntry.cid)) {
        mergedVault.push(remoteEntry);
        newEntries.push(remoteEntry);
      }
    });
    
    console.log(`Added ${newEntries.length} new entries from blockchain`);
    if (newEntries.length > 0) {
      console.log("New entries:", JSON.stringify(newEntries.map(e => ({ cid: e.cid, platform: e.platform }))));
    }
    
    return mergedVault;
  };

  // Password operations
  const deleteEntry = async (entry) => {
    try {
      updateState({ isLoading: true });
      
      const updatedVault = state.vault.filter(e => e.cid !== entry.cid);
      updateState({ vault: updatedVault });
      
      // Try to run IPFS operations but don't fail the whole operation if unpinning fails
      try {
        // Create and pin the new vault file
        const vaultData = JSON.stringify(updatedVault);
        const blob = new Blob([vaultData], { type: 'application/json' });
        const newCid = await pinFileToIPFS(blob);
        
        // Try to unpin the old file, but continue even if this fails
        try {
          await unpinFromIPFS(entry.cid);
        } catch (unpinError) {
          console.warn(`Could not unpin file ${entry.cid} from IPFS: ${unpinError.message}`);
          // Continue with the operation even if unpinning fails
        }
        
        // Update the blockchain
        if (state.vaultManager) {
          const tx = await state.vaultManager.setVaultCID(newCid);
          await tx.wait();
          
          // Update the lastKnownCID to match what's now on the blockchain
          updateState({ lastKnownCID: newCid });
        }
        
        alert("Password entry deleted successfully!");
      } catch (error) {
        console.error("Operation error:", error);
        alert("Error updating blockchain or IPFS. Your entry was removed locally.");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert(error.message || "Failed to delete entry. Please try again.");
      updateState({ vault: state.vault }); // Revert on error
    } finally {
      updateState({ isLoading: false });
    }
  };

  const encryptAndStore = async () => {
    if (!state.isIpfsInitialized) {
      alert("IPFS not initialized. Please check your connection.");
      return;
    }

    if (!state.label || !state.password || !state.platform) {
      alert("Please fill in all fields");
      return;
    }

    try {
      updateState({ isLoading: true });
      
      const encrypted = CryptoJS.AES.encrypt(state.password, state.key).toString();
      const content = JSON.stringify({ 
        platform: state.platform, 
        label: state.label, 
        encrypted 
      });
      
      const blob = new Blob([content], { type: 'application/json' });
      const cid = await pinFileToIPFS(blob);
      
      const newEntry = {
        platform: state.platform,
        label: state.label,
        cid: cid
      };
      
      // Update local state only, no contract update
      updateState({ 
        vault: [...state.vault, newEntry],
        platform: '',
        label: '',
        password: ''
      });
      
      alert("Password stored successfully!");
    } catch (error) {
      console.error("Store error:", error);
      alert(error.message || "Failed to store password. Please try again.");
    } finally {
      updateState({ isLoading: false });
    }
  };

  const decryptFromCID = async (cid) => {
    try {
      const response = await fetch(`${IPFS_GATEWAY}${cid}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch password: ${response.status}`);
      }
      
      const data = await response.json();
      const decrypted = CryptoJS.AES.decrypt(data.encrypted, state.key).toString(CryptoJS.enc.Utf8);
      return decrypted;
    } catch (error) {
      console.error("Decrypt error:", error);
      throw new Error('Failed to decrypt password.');
    }
  };

  // Wallet operations
  const connectWallet = async () => {
    if (!state.provider) {
      alert("Please install MetaMask!");
      return;
    }

    try {
      updateState({ isLoading: true, error: null });
      
      const accounts = await state.provider.send("eth_requestAccounts", []);
      const signer = await state.provider.getSigner();
      
      const contract = new ethers.Contract(
        VAULT_MANAGER_ADDRESS,
        VaultManager.abi,
        signer
      );
      
      const signature = await signer.signMessage('Generate AES key');
      const derivedKey = CryptoJS.SHA256(signature).toString();
      
      // Initialize session when wallet is connected with improved browser detection
      const browserInfo = getBrowserInfo();
      const sessionKey = generateBrowserFingerprint();
      
      const initialSession = {
        device: navigator.userAgent,
        browser: browserInfo.name,
        browserVersion: browserInfo.version,
        deviceType: getDeviceType(),
        lastActive: Date.now(),
        ip: '127.0.0.1',
        location: 'Local',
        id: sessionKey,
        isCurrentBrowser: true
      };
      
      updateState({
        account: accounts[0],
        vaultManager: contract,
        key: derivedKey,
        sessions: [initialSession],
        syncEnabled: true
      });
      
      await initializePinata();
      
      const vaultCID = await contract.getVaultCID(accounts[0]);
      if (vaultCID) {
        // Store the CID for sync comparison
        updateState({ lastKnownCID: vaultCID });
        await fetchPreviousVault(vaultCID);
      }
    } catch (error) {
      console.error("Wallet connection error:", error);
      updateState({ error: error.message });
      alert("Failed to connect wallet. Please try again.");
    } finally {
      updateState({ isLoading: false });
    }
  };

  const initializePinata = async () => {
    try {
      const testFile = new Blob(['test'], { type: 'text/plain' });
      await pinFileToIPFS(testFile);
      updateState({ isIpfsInitialized: true });
    } catch (error) {
      console.error("Pinata initialization error:", error);
      updateState({ 
        isIpfsInitialized: false,
        error: error.message
      });
      alert("Failed to initialize IPFS. Please check your API keys.");
    }
  };

  // Add new method for handling credential requests
  const handleCredentialRequest = async (url) => {
    try {
      const matchingEntry = state.vault.find(entry => 
        entry.platform.toLowerCase() === url.toLowerCase()
      );
      
      if (matchingEntry) {
        const password = await decryptFromCID(matchingEntry.cid);
        window.postMessage({
          type: 'CREDENTIALS_RESPONSE',
          credentials: {
            username: matchingEntry.label,
            password: password,
            url: url
          }
        }, '*');
      } else {
        window.postMessage({
          type: 'CREDENTIALS_RESPONSE',
          error: 'No credentials found for this site'
        }, '*');
      }
    } catch (error) {
      console.error('Credential request error:', error);
      window.postMessage({
        type: 'CREDENTIALS_RESPONSE',
        error: error.message
      }, '*');
    }
  };

  // Add this function inside your PasswordManager component
  const syncWithExtension = async () => {
    try {
      updateState({ isLoading: true });
      
      // Prepare data for the extension in the format it expects
      const extensionPasswords = await Promise.all(
        state.vault.map(async (entry) => {
          try {
            // Decrypt the password
            const decryptedPassword = await decryptFromCID(entry.cid);
            
            // Return in the format expected by the extension
            return {
              website: entry.platform,
              username: entry.label,
              password: decryptedPassword,
              id: entry.cid // Using CID as the unique ID
            };
          } catch (error) {
            console.error(`Error decrypting password for ${entry.label}:`, error);
            return null;
          }
        })
      );
      
      // Filter out any entries that failed to decrypt
      const validPasswords = extensionPasswords.filter(entry => entry !== null);
      
      // Send to the server
      const response = await fetch('http://localhost:3001/api/passwords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ passwords: validPasswords })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Passwords synced with the browser extension successfully!');
      } else {
        alert('Failed to sync passwords: ' + data.error);
      }
    } catch (error) {
      console.error('Error syncing passwords:', error);
      alert('Failed to sync passwords with the extension: ' + error.message);
    } finally {
      updateState({ isLoading: false });
    }
  };

  // Add a separate timer just for updating the sync time display
  useEffect(() => {
    if (!state.account) return;
    
    // This separate timer ensures the UI always shows an up-to-date sync time
    // even if the blockchain check encounters issues
    const updateSyncTimeDisplay = () => {
      const lastCheck = state.lastSyncTime || "Never";
      console.log(`Last sync check was at: ${lastCheck}`);
    };
    
    // Check sync status every 10 seconds - this is just for UI updates
    const displayTimer = setInterval(updateSyncTimeDisplay, 10000);
    
    return () => clearInterval(displayTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.account, state.lastSyncTime]);

  // Function to push local vault to blockchain
  const pushToBlockchain = async () => {
    try {
      updateState({ 
        isLoading: true,
        lastSyncTime: new Date().toLocaleTimeString() + " (Pushing)"
      });
      
      console.log(`Pushing local vault with ${state.vault.length} entries to blockchain...`);
      
      // Store local changes to blockchain
      const newCid = await storeVaultData();
      
      if (newCid) {
        updateState({ 
          lastKnownCID: newCid,
          lastSyncTime: new Date().toLocaleTimeString() + " (Push complete)"
        });
        console.log(`Push completed, new CID: ${newCid}`);
        alert("Successfully pushed vault to blockchain!");
      } else {
        updateState({
          lastSyncTime: new Date().toLocaleTimeString() + " (Nothing to push)"
        });
        console.log("No data to push or no change detected");
        alert("No changes to push to the blockchain.");
      }
    } catch (error) {
      console.error("Push error:", error);
      updateState({
        lastSyncTime: new Date().toLocaleTimeString() + " (Push error)"
      });
      alert("Failed to push to blockchain: " + error.message);
    } finally {
      updateState({ isLoading: false });
    }
  };

  // Function to pull vault from blockchain
  const pullFromBlockchain = async () => {
    try {
      updateState({ 
        isLoading: true,
        lastSyncTime: new Date().toLocaleTimeString() + " (Pulling)"
      });
      
      console.log("Pulling latest vault data from blockchain...");
      
      // Get the latest CID from blockchain
      const currentCID = await state.vaultManager.getVaultCID(state.account);
      console.log(`Current blockchain CID: ${currentCID}`);
      
      if (currentCID) {
        // Save the current vault length for comparison
        const oldVaultLength = state.vault.length;
        
        // Force a complete refresh from the blockchain and wait for it to complete
        console.log("Fetching vault and waiting for state update...");
        const newVault = await fetchPreviousVault(currentCID);
        console.log("State update completed, newVault length:", newVault.length);
        
        const newVaultLength = newVault.length;
        const difference = newVaultLength - oldVaultLength;
        
        // Update UI state after the fetch is complete
        updateState({ 
          lastKnownCID: currentCID,
          lastSyncTime: new Date().toLocaleTimeString() + " (Pull complete)",
          // Force re-render by setting the vault again
          vault: [...newVault]
        });
        
        console.log("Pull from blockchain completed successfully");
        
        if (difference < 0) {
          alert(`Successfully pulled vault from blockchain! ${Math.abs(difference)} entries were removed.`);
        } else if (difference > 0) {
          alert(`Successfully pulled vault from blockchain! ${difference} new entries were added.`);
        } else {
          alert("Successfully pulled vault from blockchain! No changes detected.");
        }
      } else {
        updateState({
          lastSyncTime: new Date().toLocaleTimeString() + " (No data)"
        });
        console.log("No data found on blockchain during pull");
        alert("No data found on the blockchain.");
      }
    } catch (error) {
      console.error("Pull error:", error);
      updateState({
        lastSyncTime: new Date().toLocaleTimeString() + " (Pull error)"
      });
      alert("Failed to pull from blockchain: " + error.message);
    } finally {
      updateState({ isLoading: false });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-gray-700/50">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center transform hover:rotate-12 transition-transform duration-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Secure Vault
              </h1>
            </div>
            {state.account ? (
              <div className="flex items-center space-x-4">
                <div className="bg-gray-700/50 px-4 py-2 rounded-xl backdrop-blur-sm">
                  <span className="text-gray-300">
                    {state.account.slice(0, 6)}...{state.account.slice(-4)}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-xl transition-all duration-300 flex items-center space-x-2 border border-red-500/20"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={state.isLoading}
                className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-4 py-2 rounded-xl transition-all duration-300 flex items-center space-x-2 border border-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state.isLoading ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>Connect Wallet</span>
                  </>
                )}
              </button>
            )}
          </div>

          {state.error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm animate-fade-in">
              {state.error}
            </div>
          )}

          {state.account && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow">
                  <div className="relative group">
                    <input
                      type="text"
                      placeholder="Platform"
                      value={state.platform}
                      onChange={(e) => updateState({ platform: e.target.value })}
                      className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-purple-500/0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  </div>
                  <div className="relative group">
                    <input
                      type="text"
                      placeholder="Username"
                      value={state.label}
                      onChange={(e) => updateState({ label: e.target.value })}
                      className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-purple-500/0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  </div>
                  <div className="relative group">
                    <input
                      type={state.showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={state.password}
                      onChange={(e) => updateState({ password: e.target.value })}
                      className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-300 pr-12"
                    />
                    <button
                      onClick={() => updateState({ showPassword: !state.showPassword })}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors duration-300"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {state.showPassword ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        )}
                      </svg>
                    </button>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-purple-500/0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  </div>
                </div>
                
                {/* Sync status indicator */}
                {state.lastSyncTime && (
                  <div className="ml-4 text-xs text-gray-400 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Synced: {state.lastSyncTime}</span>
                  </div>
                )}
              </div>

              <button
                onClick={encryptAndStore}
                disabled={state.isLoading}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center space-x-2"
              >
                {state.isLoading ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Storing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Store Password</span>
                  </>
                )}
              </button>

              <div className="mt-8">
                <h2 className="text-xl font-semibold mb-6 text-gray-300">Stored Passwords</h2>
                {state.vault.length === 0 ? (
                  <div className="text-center py-12 bg-gray-700/30 rounded-xl backdrop-blur-sm">
                    <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <p className="text-gray-400">No passwords stored yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {state.vault.map((entry, index) => (
                      <div key={index} className="bg-gray-700/30 backdrop-blur-sm p-4 rounded-xl border border-gray-600/50 hover:border-blue-500/50 transition-all duration-300 transform hover:scale-[1.02]">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-white">{entry.platform}</p>
                            <p className="text-gray-400">{entry.label}</p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={async () => {
                                try {
                                  const password = await decryptFromCID(entry.cid);
                                  alert(`Password: ${password}`);
                                } catch (error) {
                                  alert(error.message);
                                }
                              }}
                              className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-3 py-1 rounded-lg transition-all duration-300 flex items-center space-x-1 border border-blue-500/20"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>Decrypt</span>
                            </button>
                            <button
                              onClick={() => deleteEntry(entry)}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1 rounded-lg transition-all duration-300 flex items-center space-x-1 border border-red-500/20"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>remove</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Session Management UI */}
              <div className="mb-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-4">
                    <h2 className="text-xl font-semibold">Active Sessions</h2>
                    <span className="text-sm text-gray-400">
                      {state.sessions.length} / {MAX_SESSIONS}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={state.autoLogoutEnabled}
                        onChange={toggleAutoLogout}
                        className="form-checkbox h-4 w-4 text-blue-500"
                      />
                      <span>Auto-logout</span>
                    </label>
                    <select
                      value={state.autoLogoutTime / (60 * 1000)}
                      onChange={(e) => updateAutoLogoutTime(Number(e.target.value))}
                      className="bg-gray-700/50 border border-gray-600/50 rounded-lg px-3 py-1 text-sm"
                    >
                      <option value={5}>5 minutes</option>
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={0}>Never</option>
                    </select>
                  </div>
                </div>
                
                <div className="mt-4 space-y-2">
                  {renderSessions()}
                </div>
              </div>

              {/* Logout Warning Modal */}
              {state.showLogoutWarning && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-gray-800 p-6 rounded-xl max-w-md w-full mx-4">
                    <h3 className="text-xl font-semibold mb-4">Session Timeout Warning</h3>
                    <p className="text-gray-300 mb-6">
                      Your session will expire in {Math.ceil((state.autoLogoutTime - (Date.now() - state.lastActivity)) / 1000)} seconds.
                      Move your mouse or press any key to continue.
                    </p>
                    <div className="flex justify-end space-x-4">
                      <button
                        onClick={handleLogout}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-lg"
                      >
                        Logout Now
                      </button>
                      <button
                        onClick={() => updateState({ showLogoutWarning: false })}
                        className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-4 py-2 rounded-lg"
                      >
                        Stay Logged In
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Sync with Extension Button */}
              <div className="flex gap-4">
                <button
                  onClick={syncWithExtension}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center space-x-2"
                  disabled={state.isLoading}
                >
                  {state.isLoading ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Sync with Extension</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex gap-4 mt-4">
                <button
                  onClick={pushToBlockchain}
                  className="flex-1 bg-gradient-to-r from-green-500 to-blue-500 text-white px-6 py-3 rounded-xl hover:from-green-600 hover:to-blue-600 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center space-x-2"
                  disabled={state.isLoading}
                >
                  {state.isLoading ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Pushing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                      </svg>
                      <span>Push to Blockchain</span>
                    </>
                  )}
                </button>

                <button
                  onClick={pullFromBlockchain}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center space-x-2"
                  disabled={state.isLoading}
                >
                  {state.isLoading ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Pulling...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l5 5m0 0l5-5m-5 5V4" />
                      </svg>
                      <span>Pull from Blockchain</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
