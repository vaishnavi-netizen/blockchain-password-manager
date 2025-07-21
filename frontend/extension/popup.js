// Popup script for AES Password Manager Extension

document.addEventListener('DOMContentLoaded', function() {
  // Get references to DOM elements
  const connectBtn = document.getElementById('connectBtn');
  const detectFormBtn = document.getElementById('detectFormBtn');
  const detectButton = document.getElementById('detectButton');
  const statusEl = document.getElementById('status');
  const passwordListEl = document.getElementById('passwordList');

  // Function to show status message
  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = 'status ' + type;
  }

  // Function to clear status message
  function clearStatus() {
    statusEl.textContent = '';
    statusEl.className = 'status';
  }

  // Function to connect to the password manager
  function connectToPasswordManager() {
    connectBtn.disabled = true;
    showStatus('Connecting to password manager...', 'status');

    // Ask the background script to check connection
    chrome.runtime.sendMessage({ action: 'checkConnection' }, response => {
      if (chrome.runtime.lastError) {
        showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
        connectBtn.disabled = false;
        return;
      }

      if (response && response.isConnected) {
        showStatus('Connected to password manager!', 'success');
        connectBtn.textContent = 'Connected';
        detectButton.style.display = 'block';
        loadPasswords();
      } else {
        let errorMessage = 'Failed to connect to password manager.';
        
        if (response && response.error) {
          if (response.error.includes('Cannot connect to server')) {
            errorMessage = 'Cannot connect to server. Please make sure you have:';
            
            // Create detailed instructions
            const instructions = document.createElement('ol');
            instructions.className = 'error-instructions';
            
            const steps = [
              'Started the React app (npm start)',
              'Started the server.js in a separate terminal (node server.js)',
              'Confirmed server is running at http://localhost:3001'
            ];
            
            steps.forEach(step => {
              const li = document.createElement('li');
              li.textContent = step;
              instructions.appendChild(li);
            });
            
            statusEl.textContent = errorMessage;
            statusEl.className = 'status error';
            statusEl.appendChild(instructions);
            connectBtn.textContent = 'Try Again';
            connectBtn.disabled = false;
            return;
          } else {
            errorMessage += ' ' + response.error;
          }
        }
        
        showStatus(errorMessage, 'error');
        connectBtn.textContent = 'Try Again';
      }
      connectBtn.disabled = false;
    });
  }

  // Function to load passwords from the password manager
  function loadPasswords() {
    showStatus('Loading passwords...', 'status');
    
    chrome.runtime.sendMessage({ action: 'getPasswords' }, response => {
      if (chrome.runtime.lastError) {
        showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
        return;
      }

      if (response && response.success) {
        if (Array.isArray(response.passwords) && response.passwords.length > 0) {
          showStatus('Passwords loaded successfully!', 'success');
          displayPasswords(response.passwords);
        } else {
          showStatus('No passwords found in your password manager', 'error');
          passwordListEl.innerHTML = '<div class="password-item">No passwords found</div>';
        }
      } else {
        let errorMsg = 'Failed to load passwords';
        if (response && response.error) {
          if (response.error.includes('SyntaxError') || response.error.includes('Unexpected token')) {
            errorMsg = 'API returned invalid data. Make sure your password manager has the correct API endpoints.';
          } else {
            errorMsg += ': ' + response.error;
          }
        }
        showStatus(errorMsg, 'error');
      }
    });
  }

  // Function to display passwords in the popup
  function displayPasswords(passwords) {
    passwordListEl.innerHTML = '';

    if (!passwords || passwords.length === 0) {
      passwordListEl.innerHTML = '<div class="password-item">No passwords found</div>';
      return;
    }

    passwords.forEach(pwd => {
      const item = document.createElement('div');
      item.className = 'password-item';
      
      const title = document.createElement('div');
      title.textContent = pwd.website || 'Unknown Website';
      title.style.fontWeight = 'bold';
      
      const user = document.createElement('div');
      user.textContent = 'Username: ' + (pwd.username || 'Not provided');
      
      const actions = document.createElement('div');
      actions.className = 'actions';
      
      const fillBtn = document.createElement('button');
      fillBtn.textContent = 'Fill Form';
      fillBtn.addEventListener('click', () => fillForm(pwd.username, pwd.password));
      
      const copyBtn = document.createElement('button');
      copyBtn.textContent = 'Copy Password';
      copyBtn.addEventListener('click', () => {
        if (!pwd.password) {
          showStatus('No password available to copy', 'error');
          return;
        }
        
        navigator.clipboard.writeText(pwd.password)
          .then(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
              copyBtn.textContent = 'Copy Password';
            }, 1500);
          })
          .catch(err => {
            showStatus('Failed to copy: ' + err.message, 'error');
          });
      });
      
      actions.appendChild(fillBtn);
      actions.appendChild(copyBtn);
      
      item.appendChild(title);
      item.appendChild(user);
      item.appendChild(actions);
      
      passwordListEl.appendChild(item);
    });
  }

  // Function to detect and fill forms
  function detectForms() {
    showStatus('Checking for login forms...', 'status');
    
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs || !tabs[0]) {
        showStatus('No active tab found', 'error');
        return;
      }
      
      // First ensure the content script is loaded
      chrome.runtime.sendMessage({ action: 'ensureContentScriptLoaded' }, async (response) => {
        if (chrome.runtime.lastError) {
          showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        
        if (!response || !response.success) {
          showStatus('Could not load content script for this page. Some sites may restrict extensions.', 'error');
          return;
        }
        
        // Now the content script should be loaded, so we can detect forms
        chrome.tabs.sendMessage(tabs[0].id, { action: 'detectForms' }, response => {
          if (chrome.runtime.lastError) {
            showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
            return;
          }
          
          if (response && response.forms) {
            showStatus('Login form detected! Select a saved password to auto-fill it.', 'success');
          } else {
            showStatus('No login form detected on this page. The site may use a non-standard login form.', 'error');
          }
        });
      });
    });
  }

  // Function to check if content script is loaded
  function checkIfContentScriptLoaded(tabId, callback) {
    chrome.runtime.sendMessage({ action: 'ensureContentScriptLoaded' }, response => {
      callback(response && response.success);
    });
  }

  // Function to fill a form
  function fillForm(username, password) {
    if (!username || !password) {
      showStatus('Username or password is missing', 'error');
      return;
    }
    
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs || !tabs[0]) {
        showStatus('No active tab found', 'error');
        return;
      }
      
      // Ensure content script is loaded
      chrome.runtime.sendMessage({ action: 'ensureContentScriptLoaded' }, async (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          showStatus('Could not load form filler for this page', 'error');
          return;
        }
        
        // Send credentials to content script
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'fillForm',
          username: username,
          password: password
        }, response => {
          if (chrome.runtime.lastError) {
            showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
            return;
          }
          
          if (response && response.success) {
            showStatus('Form filled successfully! Look for the highlighted login button.', 'success');
          } else {
            showStatus('Form detected but could not fill all fields. The site may use a non-standard login form.', 'error');
          }
        });
      });
    });
  }

  // Add event listeners
  connectBtn.addEventListener('click', connectToPasswordManager);
  detectFormBtn.addEventListener('click', detectForms);

  // Check connection status when popup opens
  connectToPasswordManager();
}); 