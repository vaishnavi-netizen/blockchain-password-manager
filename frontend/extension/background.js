// Background script for AES Password Manager Extension

// Initialize state
let passwordManagerRunning = false;

// Function to check if the password manager is running
async function checkPasswordManager() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch('http://localhost:3001/api/check', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error('Error checking password manager:', error);
    // Return a more specific error based on the type
    if (error.name === 'AbortError') {
      throw new Error('Connection timed out. Make sure the server is running at http://localhost:3001');
    } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to server. Please make sure server.js is running at http://localhost:3001');
    } else {
      throw error;
    }
  }
}

// Function to get passwords from the password manager
async function getPasswords() {
  try {
    const response = await fetch('http://localhost:3001/api/passwords', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch passwords');
    }
    
    const data = await response.json();
    
    // Validate the data
    if (!Array.isArray(data)) {
      throw new Error('Invalid data format: expected an array');
    }
    
    // Make sure each password has the required fields
    return data.map(pwd => {
      return {
        website: pwd.website || 'Unknown Website',
        username: pwd.username || 'Not provided',
        password: pwd.password || '',
        id: pwd.id || Date.now().toString()
      };
    });
  } catch (error) {
    console.error('Error fetching passwords:', error);
    throw error;
  }
}

// Function to ensure content script is loaded
async function ensureContentScriptLoaded(tabId) {
  return new Promise((resolve) => {
    // First check if content script is already loaded
    chrome.tabs.sendMessage(tabId, { action: 'ping' }, response => {
      if (chrome.runtime.lastError || !response) {
        console.log('Content script not yet loaded, injecting it now');
        
        // Script not loaded, inject it
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }).then(() => {
          console.log('Content script injected successfully');
          resolve(true);
        }).catch(error => {
          console.error('Error injecting content script:', error);
          resolve(false);
        });
      } else {
        console.log('Content script already loaded');
        resolve(true);
      }
    });
  });
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkConnection') {
    checkPasswordManager()
      .then(isRunning => {
        passwordManagerRunning = isRunning;
        sendResponse({ 
          isConnected: isRunning,
          timestamp: Date.now()
        });
      })
      .catch(error => {
        passwordManagerRunning = false;
        sendResponse({ 
          isConnected: false,
          error: error.message
        });
      });
    return true; // Keep the message channel open for async response
  }
  
  if (message.action === 'getPasswords') {
    getPasswords()
      .then(passwords => {
        sendResponse({ success: true, passwords });
      })
      .catch(error => {
        sendResponse({ 
          success: false,
          error: error.message
        });
      });
    return true; // Keep the message channel open for async response
  }
  
  if (message.action === 'ensureContentScriptLoaded') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || !tabs[0]) {
        sendResponse({ success: false, error: 'No active tab found' });
        return;
      }
      
      try {
        const result = await ensureContentScriptLoaded(tabs[0].id);
        sendResponse({ success: result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    });
    return true;
  }
  
  // Handle ping message for content script connection check
  if (message.action === 'ping') {
    sendResponse({ status: 'ready' });
    return true;
  }
}); 