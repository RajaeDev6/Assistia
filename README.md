# AI Learning Chatbot

An interactive chatbot for learning about AI topics with a modern web interface. Built with FastAPI, MongoDB, and Together AI.

## Features

- 🔐 Secure user authentication system
- 💬 Interactive chat interface with typing animations
- 📚 Rich learning resources and explanations
- 🧪 Interactive quizzes with feedback
- 📝 Chat history with persistent storage
- 🎯 Topic-based learning structure
- 🔄 Continue previous conversations

## Prerequisites

- Python 3.8+
- MongoDB
- Together AI API key

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd Ai_chatbot
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file with the following variables:
```env
MONGODB_URI=your_mongodb_uri
TOGETHER_API_KEY=your_together_api_key
SECRET_KEY=your_secret_key_for_sessions
```

5. Make sure MongoDB is running and accessible

## Running the Application

1. Start the server:
```bash
python main.py
```

2. Open your browser and navigate to:
```
http://localhost:8000
```

## Project Structure

```
.
├── run.py              # Main FastAPI application
├── requirements.txt    # Python dependencies
├── .env               # Environment variables
├── templates/         # HTML templates
│   └── index.html    # Main application page
├── static/           # Static assets
│   ├── css/
│   │   └── style.css # Application styling
│   └── js/
│       └── app.js    # Frontend functionality
└── README.md         # Documentation
```

## API Endpoints

- `POST /api/register` - User registration
- `POST /api/login` - User login
- `POST /api/chat` - Send chat messages
- `GET /api/history` - Get chat history
- `POST /api/save-chat` - Save chat session

## Environment Variables

- `MONGODB_URI`: Your MongoDB connection string
- `TOGETHER_API_KEY`: Your Together AI API key
- `SECRET_KEY`: Secret key for session management

## Dependencies

All required packages are listed in `requirements.txt`. Main dependencies include:
- FastAPI
- Uvicorn
- Motor (MongoDB)
- Python-dotenv
- Aiohttp
- Jinja2
- PyMongo
- Python-jose
- Passlib
- BCrypt

## Features in Detail

1. **User Authentication**
   - Secure registration and login
   - Session-based authentication
   - Password hashing with BCrypt

2. **Chat Interface**
   - Real-time message display
   - Typing animations
   - Code syntax highlighting
   - Resource linking

3. **Chat History**
   - Persistent storage of conversations
   - Easy access to previous chats
   - Continue from where you left off

4. **Learning System**
   - Topic-based learning structure
   - Interactive quizzes
   - Resource recommendations
   - Progress tracking

## Security Features

- Password hashing
- Session management
- CORS protection
- HTTPS redirect support
- Trusted host middleware
- GZip compression

## Error Handling

The application includes comprehensive error handling for:
- Authentication errors
- API communication issues
- Database connection problems
- Invalid user input

## License

This project is licensed under the MIT License.
