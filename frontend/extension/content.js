// Content script to detect login forms

// Function to detect login forms on the page
function detectLoginForms() {
  // Common username and password field attributes
  const usernameSelectors = [
    // By input type and name
    'input[type="text"][name*="user" i]',
    'input[type="text"][name*="email" i]',
    'input[type="text"][name*="login" i]',
    'input[type="text"][name*="log" i]',
    'input[type="text"][name*="account" i]',
    'input[type="text"][name*="id" i]',
    'input[type="email"]',
    'input[name="username"]',
    'input[name="userid"]',
    'input[name="user_id"]',
    'input[name="email"]',
    'input[name="login"]',
    'input[name="loginid"]',
    'input[name="login_id"]',
    'input[name="logonid"]',
    'input[name="logon_id"]',
    'input[autocomplete="username"]',
    // By input type and ID
    'input[type="text"][id*="user" i]',
    'input[type="text"][id*="email" i]',
    'input[type="text"][id*="login" i]',
    'input[type="text"][id*="log" i]',
    'input[type="text"][id*="account" i]',
    'input[type="text"][id*="id" i]',
    'input[id="username"]',
    'input[id="userid"]',
    'input[id="user_id"]',
    'input[id="email"]',
    'input[id="login"]',
    'input[id="loginid"]',
    'input[id="login_id"]',
    // By class
    'input[type="text"][class*="user" i]',
    'input[type="text"][class*="email" i]',
    'input[type="text"][class*="login" i]',
    'input[type="text"][class*="username" i]',
    // By placeholder
    'input[placeholder*="user" i]',
    'input[placeholder*="email" i]',
    'input[placeholder*="login" i]',
    'input[placeholder*="name" i]',
    'input[placeholder*="account" i]',
    'input[placeholder*="id" i]'
  ];

  const passwordSelectors = [
    'input[type="password"]',
    'input[name*="pass" i]',
    'input[id*="pass" i]',
    'input[class*="pass" i]',
    'input[placeholder*="pass" i]',
    'input[autocomplete="current-password"]'
  ];

  // Helper function to uniquely add fields to an array
  function addUniqueFields(array, fields) {
    for (const field of fields) {
      if (!array.includes(field)) {
        array.push(field);
      }
    }
  }

  // Find all potential username fields
  const userFields = [];
  usernameSelectors.forEach(selector => {
    const fields = document.querySelectorAll(selector);
    addUniqueFields(userFields, Array.from(fields));
  });

  // Find all password fields
  const passwordFields = [];
  passwordSelectors.forEach(selector => {
    const fields = document.querySelectorAll(selector);
    addUniqueFields(passwordFields, Array.from(fields));
  });

  // No password field found = not a login form
  if (passwordFields.length === 0) {
    return [];
  }

  console.log(`[AES] Found ${userFields.length} potential username fields`);
  console.log(`[AES] Found ${passwordFields.length} password fields`);

  // Look for forms that have both a user field and password field
  const loginForms = [];
  
  // Check if they're in the same form
  userFields.forEach(userField => {
    passwordFields.forEach(passwordField => {
      if (userField.form && passwordField.form && userField.form === passwordField.form) {
        loginForms.push({
          form: userField.form,
          userField: userField,
          passwordField: passwordField
        });
      }
    });
  });

  // If we found forms with both fields, return them
  if (loginForms.length > 0) {
    return loginForms;
  }

  // If no complete forms found, check if fields are nearby each other in the DOM
  // This helps with sites that don't use <form> elements
  if (userFields.length > 0 && passwordFields.length > 0) {
    // Get the first password field (most likely the primary one)
    const passwordField = passwordFields[0];
    
    // Find the closest username field
    let bestUserField = null;
    let minDistance = Infinity;
    
    userFields.forEach(userField => {
      // Simple DOM distance - count parents until common ancestor
      let userParent = userField.parentElement;
      let userAncestors = 0;
      let foundCommon = false;
      
      while (userParent && userAncestors < 10) {
        let pwdParent = passwordField.parentElement;
        let pwdAncestors = 0;
        
        while (pwdParent && pwdAncestors < 10) {
          if (userParent === pwdParent) {
            const distance = userAncestors + pwdAncestors;
            if (distance < minDistance) {
              minDistance = distance;
              bestUserField = userField;
            }
            foundCommon = true;
            break;
          }
          pwdParent = pwdParent.parentElement;
          pwdAncestors++;
        }
        
        if (foundCommon) break;
        userParent = userParent.parentElement;
        userAncestors++;
      }
    });
    
    if (bestUserField) {
      loginForms.push({
        form: null, // No actual form element
        userField: bestUserField,
        passwordField: passwordField
      });
    }
  }
  
  // If we still have no forms but have password fields, use the first password field
  // and assume the site might handle username separately
  if (loginForms.length === 0 && passwordFields.length > 0) {
    loginForms.push({
      form: passwordFields[0].form,
      userField: null, // No username field found
      passwordField: passwordFields[0]
    });
  }

  // Log the detected forms for debugging
  console.log(`[AES] Detected ${loginForms.length} login forms`);
  
  return loginForms;
}

// Function to fill a login form
function fillLoginForm(username, password) {
  const loginForms = detectLoginForms();
  
  if (loginForms.length > 0) {
    // Fill the first detected form
    const form = loginForms[0];
    
    // Only fill username if we found a username field
    if (form.userField && username) {
      form.userField.value = username;
      form.userField.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Also try to trigger change event for React and other frameworks
      form.userField.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Fill password
    if (form.passwordField && password) {
      form.passwordField.value = password;
      form.passwordField.dispatchEvent(new Event('input', { bubbles: true }));
      form.passwordField.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Try to highlight the login button if available
    highlightLoginButton();
    
    return true;
  }
  
  return false;
}

// Helper function to highlight the login button
function highlightLoginButton() {
  // Common selectors for login buttons
  const buttonSelectors = [
    'input[type="submit"]',
    'button[type="submit"]',
    'button[name*="login" i]',
    'button[id*="login" i]',
    'button[class*="login" i]',
    'button[class*="submit" i]',
    'button:contains("Log In")',
    'button:contains("Login")',
    'button:contains("Sign In")',
    'button:contains("Signin")',
    'a[href*="login" i]',
    'a[class*="login" i]',
    'a[id*="login" i]',
    'input[value*="Login" i]',
    'input[value*="Log In" i]',
    'input[value*="Sign In" i]'
  ];
  
  // Try to find login button
  let loginButton = null;
  
  for (const selector of buttonSelectors) {
    try {
      const buttons = document.querySelectorAll(selector);
      if (buttons.length > 0) {
        loginButton = buttons[0];
        break;
      }
    } catch (e) {
      // Some selectors might cause errors in certain browsers
      continue;
    }
  }
  
  // If found, add a subtle highlight
  if (loginButton) {
    const originalBackgroundColor = loginButton.style.backgroundColor;
    const originalBoxShadow = loginButton.style.boxShadow;
    
    loginButton.style.backgroundColor = '#e6f7ff';
    loginButton.style.boxShadow = '0 0 5px #1890ff';
    
    // Remove highlight after 2 seconds
    setTimeout(() => {
      loginButton.style.backgroundColor = originalBackgroundColor;
      loginButton.style.boxShadow = originalBoxShadow;
    }, 2000);
  }
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'detectForms') {
    const forms = detectLoginForms();
    sendResponse({ forms: forms.length > 0 });
  } 
  else if (message.action === 'fillForm') {
    const success = fillLoginForm(message.username, message.password);
    sendResponse({ success });
  }
  else if (message.action === 'ping') {
    // Respond to ping to confirm content script is loaded
    sendResponse({ status: 'ready' });
  }
  return true; // Keep the message channel open for async response
});

function checkIfContentScriptLoaded(tabId, callback) {
  chrome.tabs.sendMessage(tabId, { action: 'ping' }, function(response) {
    if (chrome.runtime.lastError) {
      callback(false);
    } else {
      callback(true);
    }
  });
} 