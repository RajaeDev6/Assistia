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
let globalScore = 0;

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
    loadGlobalScore();
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

// Function to update progress bars
function updateProgressBars(score) {
    const progressBar = document.querySelector('.progress-bar');
    if (!progressBar) {
        console.error('Progress bar not found');
        return;
    }
    
    const currentScore = Math.min(100, Math.max(0, parseInt(score) || 0));
    
    // Update width and text
    progressBar.style.width = currentScore + '%';
    progressBar.textContent = `${currentScore}/100`;
    
    // Update colors
    if (currentScore >= 100) {
        progressBar.className = 'progress-bar bg-success';
    } else {
        progressBar.className = 'progress-bar bg-info';
    }
    
    // Update level
    const userLevel = document.getElementById('user-level');
    if (userLevel) {
        userLevel.textContent = currentScore >= 100 ? 'Intermediate' : 'Beginner';
    }
}

// Handle quiz completion and score update
async function handleQuizCompletion(finalScore) {
    let pointsEarned = 0;
    if (finalScore === 100) {
        pointsEarned = 10;
    } else if (finalScore >= 60) {
        pointsEarned = 3;
    }

    if (pointsEarned > 0) {
        try {
            // Get current progress
            const progressResponse = await fetch('/api/progress', {
                credentials: 'include'
            });
            
            if (!progressResponse.ok) {
                throw new Error('Failed to get current progress');
            }
            
            const progressData = await progressResponse.json();
            const currentScore = parseInt(progressData.progress) || 0;
            const newScore = Math.min(100, currentScore + pointsEarned);

            // Update progress on server
            const response = await fetch('/api/update-progress', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    score: newScore
                }),
                credentials: 'include'
            });

            if (response.ok) {
                // Update progress bar immediately
                updateProgressBars(newScore);
                await addMessageWithTyping(`🌟 You earned ${pointsEarned} points! Your total score is now ${newScore}/100`, 'ai');
            } else {
                throw new Error('Failed to update progress');
            }
        } catch (error) {
            console.error('Error updating progress:', error);
            showError('Failed to update progress');
        }
    }
}

// Handle quiz answers
async function handleQuizAnswer(message, quizState) {
    if (!quizState || !quizState.currentQuestion) {
        return false;
    }

    const answer = message.trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(answer)) {
        return false;
    }

    const isCorrect = answer === quizState.currentQuestion.correct;
    const feedback = isCorrect ? 
        "✅ Correct!" : 
        `❌ Incorrect. The correct answer was ${quizState.currentQuestion.correct}.`;

    await addMessageWithTyping(feedback, 'ai');

    quizState.score = (quizState.score || 0) + (isCorrect ? 1 : 0);
    quizState.answeredQuestions = (quizState.answeredQuestions || 0) + 1;

    if (quizState.answeredQuestions >= quizState.questions.length) {
        const finalScore = Math.round((quizState.score / quizState.questions.length) * 100);
        await addMessageWithTyping(`Quiz completed! Your score: ${finalScore}%`, 'ai');

        let pointsEarned = 0;
        if (finalScore === 100) {
            pointsEarned = 10;
        } else if (finalScore >= 60) {
            pointsEarned = 3;
        }

        if (pointsEarned > 0) {
            try {
                // Get current progress
                const progressResponse = await fetch('/api/progress', {
                    credentials: 'include'
                });
                
                if (!progressResponse.ok) {
                    throw new Error('Failed to get current progress');
                }
                
                const progressData = await progressResponse.json();
                const currentScore = parseInt(progressData.progress) || 0;
                const newScore = Math.min(100, currentScore + pointsEarned);

                // Update progress on server
                const response = await fetch('/api/update-progress', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        score: newScore
                    }),
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error('Failed to update progress');
                }

                // Update progress bar immediately
                updateProgressBars(newScore);
                await addMessageWithTyping(`🌟 You earned ${pointsEarned} points! Your total score is now ${newScore}/100`, 'ai');
            } catch (error) {
                console.error('Error updating progress:', error);
                showError('Failed to update progress');
            }
        }

        quizState = null;
    } else {
        await showNextQuestion(quizState);
    }

    return true;
}

// Function to show next question
async function showNextQuestion(quizState) {
    if (!quizState || quizState.currentQuestionIndex >= quizState.questions.length) {
        return;
    }

    const question = quizState.questions[quizState.currentQuestionIndex];
    quizState.currentQuestion = question;
    quizState.currentQuestionIndex++;

    const questionText = `Question ${quizState.currentQuestionIndex} of ${quizState.questions.length}:\n${question.question}\n\n${question.options.join('\n')}`;
    await addMessageWithTyping(questionText, 'ai');
}

// Function to start a quiz
async function startQuiz(topic) {
    try {
        const response = await fetch('/static/js/quiz.json');
        if (!response.ok) {
            throw new Error('Failed to load quiz data');
        }

        const quizData = await response.json();
        if (!quizData[topic]) {
            throw new Error('No quiz available for this topic');
        }

        const questions = quizData[topic].questions;
        if (!questions || questions.length === 0) {
            throw new Error('No questions available for this topic');
        }

        // Shuffle questions and select 5
        const shuffledQuestions = [...questions].sort(() => Math.random() - 0.5).slice(0, 5);

        quizState = {
            questions: shuffledQuestions,
            currentQuestionIndex: 0,
            score: 0,
            answeredQuestions: 0
        };

        await addMessageWithTyping("Let's start the quiz! Answer each question by typing the letter of your choice (A, B, C, or D).", 'ai');
        await showNextQuestion(quizState);

    } catch (error) {
        console.error('Error starting quiz:', error);
        await addMessageWithTyping('Sorry, I could not start the quiz at this time.', 'ai');
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
    // Only proceed if there are actual messages to save
    const messages = document.querySelectorAll('.message');
    if (messages.length > 0) {
        try {
            // Save current chat if it exists and has messages
            const chatMessages = Array.from(messages).map(msg => ({
                content: msg.innerHTML,
                sender: msg.classList.contains('user-message') ? 'user' : 'ai'
            }));

            const response = await fetch('/api/save-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'user-id': localStorage.getItem('user_id')
                },
                body: JSON.stringify({
                    topic: currentTopic,
                    messages: chatMessages,
                    quiz_state: quizState
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to save chat');
            }
        } catch (error) {
            console.error('Error saving chat:', error);
            showError('Failed to save chat');
            return;
        }
    }

    // Clear chat interface
    chatMessages.innerHTML = '';
    messageInput.value = '';
    
    // Reset quiz state
    quizState = null;
    
    // Show topics grid and hide chat interface
    topicsGrid.classList.remove('hidden');
    chatInterface.classList.add('hidden');
    
    // Refresh chat history
    loadChatHistory();
}

// Function to load initial global score
async function loadGlobalScore() {
    try {
        const response = await fetch('/progress', {
            credentials: 'include'
        });
        if (response.ok) {
            const data = await response.json();
            globalScore = parseInt(data.progress) || 0;
            updateProgressBars(globalScore);
        }
    } catch (error) {
        console.error('Error loading global score:', error);
    }
}

// Call this when page loads
document.addEventListener('DOMContentLoaded', loadGlobalScore);

// Load initial progress when page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/progress', {
            credentials: 'include'
        });
        if (response.ok) {
            const data = await response.json();
            updateProgressBars(data.progress);
        }
    } catch (error) {
        console.error('Error loading initial progress:', error);
    }
});

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

// Update sendMessage function to refresh history after each message
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    // Clear input
    messageInput.value = '';

    // Add user message
    await addMessageWithTyping(message, 'user');

    // If in quiz mode, handle quiz answer
    if (quizState) {
        const handled = await handleQuizAnswer(message, quizState);
        if (handled) {
            return;
        }
    }

    // Show typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.classList.add('message', 'ai-message', 'typing');
    typingIndicator.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    chatMessages.appendChild(typingIndicator);

    try {
        // Check for quiz or resource requests using simple NLU
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes('quiz') || lowerMessage.includes('test') || lowerMessage.includes('assessment')) {
            typingIndicator.remove();
            await startQuiz(currentTopic);
            return;
        }

        if (lowerMessage.includes('resource') || lowerMessage.includes('link') || lowerMessage.includes('learn more')) {
            const response = await fetch('/static/js/resources.json');
            if (response.ok) {
                const resourceData = await response.json();
                const topicResources = resourceData[currentTopic];
                
                if (topicResources) {
                    typingIndicator.remove();
                    let resourceMessage = `Here are some resources for ${topicResources.name}:\n\n`;
                    topicResources.resources.forEach(resource => {
                        resourceMessage += `📚 ${resource.title}\n${resource.url}\n${resource.description}\n\n`;
                    });
                    await addMessageWithTyping(resourceMessage, 'ai');
                    return;
                }
            }
        }

        // Regular chat message
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message,
                topic: currentTopic
            }),
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to send message');
        }

        const data = await response.json();
        typingIndicator.remove();
        await addMessageWithTyping(data.response, 'ai');

    } catch (error) {
        console.error('Error sending message:', error);
        typingIndicator.remove();
        showError('Failed to send message');
    }

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
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
        const response = await fetch('/progress', {
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