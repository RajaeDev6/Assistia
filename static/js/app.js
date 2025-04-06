// DOM Elements
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const tabButtons = document.querySelectorAll('.tab-btn');
const topicsGrid = document.querySelector('.topics-grid');
const chatInterface = document.querySelector('.chat-interface');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const usernameDisplay = document.getElementById('username-display');
const progressBar = document.getElementById('progress-bar');
const userLevel = document.getElementById('user-level');
const historyList = document.getElementById('history-list');

// Current state
let currentUser = null;
let currentTopic = null;
let quizState = null;
let chatHistory = [];

// Tab switching
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        loginForm.classList.remove('active');
        registerForm.classList.remove('active');
        document.getElementById(`${tab}-form`).classList.add('active');
    });
});

// Authentication
async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert(data.error);
            return;
        }
        
        if (data.success) {
            currentUser = data.user.username;
            // Store user ID in localStorage
            localStorage.setItem('user_id', data.user._id);
            showApp();
            // Load chat history after login
            loadChatHistory();
        }
    } catch (error) {
        alert('An error occurred during login');
    }
}

async function register() {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    
    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert(data.error);
            return;
        }
        
        alert(data.message);
        
        // Switch to login tab after successful registration
        document.querySelector('[data-tab="login"]').click();
        document.getElementById('login-username').value = username;
        document.getElementById('login-password').value = '';
    } catch (error) {
        alert('An error occurred during registration');
    }
}

// Show/hide app
function showApp() {
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    usernameDisplay.textContent = currentUser;
    loadUserProgress();
    loadChatHistory();
}

// Check for existing session on page load
async function checkSession() {
    try {
        const response = await fetch('/api/check-session', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.user) {
                currentUser = data.user.username;
                // Store user ID in localStorage
                localStorage.setItem('user_id', data.user._id);
                showApp();
                // Load chat history after session check
                loadChatHistory();
            }
        }
    } catch (error) {
        console.error('Error checking session:', error);
    }
}

// Call checkSession when the page loads
document.addEventListener('DOMContentLoaded', checkSession);

// Function to add message with typing effect
async function addMessageWithTyping(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
    chatMessages.appendChild(messageDiv);
    
    if (sender === 'ai') {
        // Show typing indicator first
        const typingIndicator = document.createElement('div');
        typingIndicator.classList.add('typing-indicator');
        typingIndicator.innerHTML = '<span></span><span></span><span></span>';
        messageDiv.appendChild(typingIndicator);
        
        // Wait a bit to show typing
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Remove typing indicator
        typingIndicator.remove();
        
        // Convert markdown links to HTML
        const linkedText = text.replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
        );
        
        // Split into words while preserving HTML tags
        const words = linkedText.split(/(\s+)/).filter(word => word.length > 0);
        let currentText = '';
        
        // Add words one by one
        for (let word of words) {
            currentText += word;
            messageDiv.innerHTML = currentText;
            chatMessages.scrollTop = chatMessages.scrollHeight;
            // Only delay for actual words, not HTML tags
            if (!word.startsWith('<') && !word.endsWith('>')) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
    } else {
        messageDiv.textContent = text;
    }
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
}

// Handle quiz answers
async function handleQuizAnswer(message, quizState) {
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message,
                topic: currentTopic,
                quiz_state: quizState
            }),
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to process quiz answer');
        }
        
        const data = await response.json();
        
        // Add AI response with typing effect
        await addMessageWithTyping(data.response, 'ai');
        
        // Update quiz state if present
        if (data.quiz_state) {
            quizState = data.quiz_state;
        } else if (data.quiz_completed) {
            quizState = null;
            // Reload progress after quiz completion
            loadUserProgress();
        }
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        console.error('Error handling quiz answer:', error);
        showError('Failed to process quiz answer');
    }
}

// Function to load chat history
async function loadChatHistory() {
    try {
        const userId = localStorage.getItem('user_id');
        if (!userId) return;

        const response = await fetch('/api/history', {
            headers: { 'user-id': userId }
        });

        if (!response.ok) throw new Error('Failed to load chat history');

        const data = await response.json();
        historyList.innerHTML = '';

        if (!data.history || data.history.length === 0) {
            historyList.innerHTML = '<div class="history-item empty">No chat history</div>';
            return;
        }

        data.history.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.classList.add('history-item');
            chatItem.dataset.chatId = chat._id;
            
            const date = new Date(chat.timestamp);
            const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

            chatItem.innerHTML = `
                <div class="chat-info">
                    <div class="chat-topic">${chat.topic || 'Untitled'}</div>
                    <div class="chat-preview">${chat.preview || 'Empty chat'}</div>
                    <div class="chat-date">${formattedDate}</div>
                </div>
            `;

            chatItem.addEventListener('click', () => loadChat(chat));
            historyList.appendChild(chatItem);
        });
    } catch (error) {
        console.error('Error loading chat history:', error);
        showError('Failed to load chat history');
    }
}

// Function to load a specific chat
async function loadChat(chat) {
    try {
        // Save current chat if there are messages
        if (chatMessages.children.length > 0) {
            await newChat();
        }

        // Clear current chat
        chatMessages.innerHTML = '';
        
        // Set current topic and quiz state
        currentTopic = chat.topic;
        quizState = chat.quiz_state || null;
        
        // Show chat interface
        topicsGrid.classList.add('hidden');
        chatInterface.classList.remove('hidden');
        
        // Mark chat as active
        document.querySelectorAll('.history-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.chatId === chat._id) {
                item.classList.add('active');
            }
        });

        // Display messages exactly as they were saved
        if (chat.messages && chat.messages.length > 0) {
            for (const msg of chat.messages) {
                const messageDiv = document.createElement('div');
                messageDiv.classList.add('message', msg.sender === 'user' ? 'user-message' : 'ai-message');
                messageDiv.innerHTML = msg.content;
                chatMessages.appendChild(messageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                // Small delay between messages for better UX
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        console.error('Error loading chat:', error);
        showError('Failed to load chat');
    }
}

// Function to save current chat and start new one
async function newChat() {
    try {
        // Save current chat if there are messages
        if (chatMessages.children.length > 0) {
            const messages = [];
            chatMessages.querySelectorAll('.message').forEach(msg => {
                // Save the exact HTML content to preserve formatting, links, and structure
                messages.push({
                    content: msg.innerHTML,
                    sender: msg.classList.contains('user-message') ? 'user' : 'ai'
                });
            });

            if (messages.length > 0) {
                await fetch('/api/save-chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'user-id': localStorage.getItem('user_id')
                    },
                    body: JSON.stringify({
                        topic: currentTopic,
                        messages: messages,
                        quiz_state: quizState
                    })
                });
            }
        }

        // Clear chat and reset states
        chatMessages.innerHTML = '';
        currentTopic = null;
        quizState = null;

        // Show topics grid
        topicsGrid.classList.remove('hidden');
        chatInterface.classList.add('hidden');

        // Refresh chat history
        await loadChatHistory();

    } catch (error) {
        console.error('Error in newChat:', error);
        showError('Failed to save chat');
    }
}

// Update sendMessage function to refresh history after each message
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    messageInput.value = '';
    messageInput.disabled = true;

    // Add user message
    const userMessageDiv = document.createElement('div');
    userMessageDiv.classList.add('message', 'user-message');
    userMessageDiv.textContent = message;
    chatMessages.appendChild(userMessageDiv);

    // Show typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.classList.add('message', 'ai-message', 'typing');
    typingIndicator.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    chatMessages.appendChild(typingIndicator);

    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                topic: currentTopic,
                quiz_state: quizState
            })
        });

        const data = await response.json();
        typingIndicator.remove();

        if (data.error) {
            showError(data.error);
            messageInput.disabled = false;
            return;
        }

        // Handle quiz state
        if (data.quiz_state) {
            quizState = data.quiz_state;
            await handleQuizAnswer(message, quizState);
            messageInput.disabled = false;
            return;
        }

        // Handle multiple messages
        if (data.multiple_messages && Array.isArray(data.response)) {
            for (const msg of data.response) {
                await addMessageWithTyping(msg.response, 'ai');
            }
        } else {
            // Handle single message
            await addMessageWithTyping(data.response, 'ai');
        }

        // Save chat after each message
        await newChat();
        await loadChatHistory();

        messageInput.disabled = false;
        chatMessages.scrollTop = chatMessages.scrollHeight;

    } catch (error) {
        typingIndicator.remove();
        showError('An error occurred while sending the message');
        messageInput.disabled = false;
    }
}

// Function to update progress bars
function updateProgressBars(progress) {
    const progressBar = document.getElementById('progress-bar');
    if (!progressBar) return;
    
    // Calculate total progress
    let totalProgress = 0;
    let topicCount = 0;
    
    for (const topic in progress) {
        if (typeof progress[topic] === 'number' && !isNaN(progress[topic])) {
            totalProgress += progress[topic];
            topicCount++;
        }
    }
    
    // Calculate average progress
    const averageProgress = topicCount > 0 ? totalProgress / topicCount : 0;
    
    // Update the progress bar
    progressBar.style.width = `${Math.min(100, averageProgress)}%`;
    progressBar.textContent = `${Math.round(Math.min(100, averageProgress))}%`;
    
    // Update user level
    const userLevel = document.getElementById('user-level');
    if (userLevel) {
        if (averageProgress >= 100) {
            userLevel.textContent = 'Level: Advanced';
        } else if (averageProgress >= 50) {
            userLevel.textContent = 'Level: Intermediate';
        } else {
            userLevel.textContent = 'Level: Beginner';
        }
    }
}

// Topic selection
topicsGrid.addEventListener('click', async (e) => {
    const topicCard = e.target.closest('.topic-card');
    if (topicCard) {
        currentTopic = topicCard.dataset.topic;
        topicsGrid.classList.add('hidden');
        chatInterface.classList.remove('hidden');
        
        // Clear chat messages
        chatMessages.innerHTML = '';
        
        // Show typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.classList.add('message', 'ai-message', 'typing');
        typingIndicator.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
        chatMessages.appendChild(typingIndicator);

        try {
            // Get initial topic explanation
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    topic: currentTopic
                }),
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to load topic information');
            }
            
            const data = await response.json();
            
            // Remove typing indicator
            typingIndicator.remove();
            
            // Add AI's introduction message with typing effect
            await addMessageWithTyping(data.response, 'ai');
            
            // Create subtopics container
            const subtopicsContainer = document.createElement('div');
            subtopicsContainer.classList.add('subtopics-container');
            
            // Add subtopics header
            const subtopicsHeader = document.createElement('h3');
            subtopicsHeader.textContent = 'Available Subtopics:';
            subtopicsContainer.appendChild(subtopicsHeader);
            
            // Add subtopics as clickable buttons
            data.subtopics.forEach(subtopic => {
                const subtopicButton = document.createElement('button');
                subtopicButton.classList.add('subtopic-button');
                subtopicButton.textContent = subtopic;
                subtopicButton.addEventListener('click', async () => {
                    // Show typing indicator
                    const typingIndicator = document.createElement('div');
                    typingIndicator.classList.add('message', 'ai-message', 'typing');
                    typingIndicator.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
                    chatMessages.appendChild(typingIndicator);
                    
                    try {
                        // Get subtopic explanation
                        const response = await fetch('/api/chat', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                topic: currentTopic,
                                message: `Explain ${subtopic} in 1-2 sentences`
                            }),
                            credentials: 'include'
                        });
                        
                        if (!response.ok) {
                            throw new Error('Failed to get subtopic explanation');
                        }
                        
                        const data = await response.json();
                        
                        // Remove typing indicator
                        typingIndicator.remove();
                        
                        // Add AI's explanation with typing effect
                        await addMessageWithTyping(data.response, 'ai');
                        
                        // Scroll to bottom
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    } catch (error) {
                        typingIndicator.remove();
                        showError(error.message);
                    }
                });
                subtopicsContainer.appendChild(subtopicButton);
            });
            
            chatMessages.appendChild(subtopicsContainer);
            
            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } catch (error) {
            typingIndicator.remove();
            showError(error.message);
        }
    }
});

// User progress
async function loadUserProgress() {
    try {
        const response = await fetch('/api/progress', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load progress');
        }
        
        const data = await response.json();
        updateProgressBars(data.progress);
    } catch (error) {
        console.error('Error loading progress:', error);
    }
}

// Error handling
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.classList.add('error-message');
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}

// Event listeners
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Add event listener for new chat button
document.getElementById('new-chat-btn').addEventListener('click', newChat);

// Load chat history when page loads
document.addEventListener('DOMContentLoaded', loadChatHistory);

// Add event listener for logout button
document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            // Clear local storage
            localStorage.removeItem('user_id');
            
            // Hide app container and show auth container
            document.getElementById('app-container').classList.add('hidden');
            document.getElementById('auth-container').classList.remove('hidden');
            
            // Reset any active states
            document.querySelector('.chat-interface').classList.add('hidden');
            document.querySelector('.topics-grid').classList.remove('hidden');
            
            // Clear chat messages
            document.getElementById('chat-messages').innerHTML = '';
            
            // Reset input fields
            document.getElementById('message-input').value = '';
            
            console.log('Logged out successfully');
        } else {
            showError('Failed to logout');
        }
    } catch (error) {
        console.error('Error logging out:', error);
        showError('Failed to logout');
    }
}); 