import os
from fastapi import FastAPI, Request, Response, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
import uvicorn
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import hashlib
import secrets
from datetime import datetime, timedelta
import aiohttp
from typing import Optional
from urllib.parse import quote_plus, unquote
import asyncio
from contextlib import asynccontextmanager
from bson.objectid import ObjectId
import random
import json
import re

# Load environment variables
load_dotenv()

# Get Together AI API key
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY")
if not TOGETHER_API_KEY:
    raise ValueError("TOGETHER_API_KEY not found in environment variables")

# Get MongoDB URI from environment variables
MONGODB_URI = os.getenv('MONGODB_URI')
if not MONGODB_URI:
    raise ValueError("MONGODB_URI not found in environment variables")

# Initialize MongoDB client
client = AsyncIOMotorClient(MONGODB_URI)
db = client.ai_learning_bot

# Initialize FastAPI app
app = FastAPI()

# Add CORS middleware
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Session storage (in-memory for simplicity)
sessions = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: verify database connection
    try:
        await client.admin.command('ping')
        print("Successfully connected to MongoDB")
    except Exception as e:
        print(f"MongoDB Connection Error: {str(e)}")
        print("Please verify your MongoDB URI includes correct username, password, and database")
        raise
    yield
    # Shutdown: cleanup
    client.close()
    print("Closed MongoDB connection")

# Initialize FastAPI app with lifespan
app = FastAPI(lifespan=lifespan)

# Create directories if they don't exist
os.makedirs("static/js", exist_ok=True)
os.makedirs("static/css", exist_ok=True)
os.makedirs("templates", exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize templates
templates = Jinja2Templates(directory="templates")

# Dependency to get current user
async def get_current_user(request: Request) -> Optional[dict]:
    session_token = request.cookies.get("session_token")
    if not session_token:
        return None
    
    session = sessions.get(session_token)
    if not session or session["expires"] < datetime.now():
        return None
    
    # Extend session expiration
    session["expires"] = datetime.now() + timedelta(days=7)
    sessions[session_token] = session
    
    user = await db.users.find_one({"username": session["username"]})
    return user

# Authentication routes
@app.post("/api/register")
async def register(request: Request):
    try:
        data = await request.json()
        username = data.get("username")
        password = data.get("password")
        
        if not username or not password:
            return {"error": "Username and password are required"}
        
        # Check if user exists
        existing_user = await db.users.find_one({"username": username})
        if existing_user:
            return {"error": "Username already exists"}
        
        # Hash password
        hashed_password = hashlib.sha256(password.encode()).hexdigest()
        
        # Create user
        user = {
            "username": username,
            "password": hashed_password,
            "level": "beginner",
            "progress": {
                "subtopics_explored": 0,
                "quiz_scores": {}
            }
        }
        result = await db.users.insert_one(user)
        
        if not result.inserted_id:
            return {"error": "Failed to create user"}
            
        return {"message": "Registration successful! You can now login."}
    except Exception as e:
        return {"error": f"Database error: {str(e)}"}

@app.post("/api/login")
async def login(request: Request, response: Response):
    try:
        data = await request.json()
        username = data.get("username")
        password = data.get("password")
        
        if not username or not password:
            return {"error": "Username and password are required"}
        
        # Find user
        user = await db.users.find_one({"username": username})
        if not user:
            return {"error": "Invalid credentials"}
        
        # Verify password
        hashed_password = hashlib.sha256(password.encode()).hexdigest()
        if user["password"] != hashed_password:
            return {"error": "Invalid credentials"}
        
        # Create session with longer expiration
        session_token = secrets.token_hex(32)
        sessions[session_token] = {
            "username": username,
            "expires": datetime.now() + timedelta(days=7)  # 7 days expiration
        }
        
        # Set secure cookie with longer expiration
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=7*24*60*60  # 7 days in seconds
        )
        
        return {
            "success": True,
            "message": "Login successful!",
            "user": {
                "username": username,
                "level": user.get("level", "beginner")
            }
        }
    except Exception as e:
        return {"error": f"Database error: {str(e)}"}

# Session check endpoint
@app.get("/api/check-session")
async def check_session(current_user: dict = Depends(get_current_user)):
    if not current_user:
        return {"user": None}
    return {
        "user": {
            "username": current_user["username"],
            "level": current_user.get("level", "beginner")
        }
    }

# Main route
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# Topic information
TOPICS = {
    "machine-learning": {
        "name": "Machine Learning",
        "description": "Machine Learning is a subset of artificial intelligence that focuses on developing systems that can learn from and make decisions based on data.",
        "subtopics": [
            "Supervised Learning",
            "Unsupervised Learning",
            "Reinforcement Learning"
        ]
    },
    "neural-networks": {
        "name": "Neural Networks",
        "description": "Neural Networks are computing systems inspired by the biological neural networks that constitute animal brains.",
        "subtopics": [
            "Perceptrons",
            "Deep Learning",
            "Backpropagation"
        ]
    },
    "nlp": {
        "name": "Natural Language Processing",
        "description": "NLP is a branch of AI that helps computers understand, interpret and manipulate human language.",
        "subtopics": [
            "Text Classification",
            "Language Models",
            "Sentiment Analysis"
        ]
    },
    "computer-vision": {
        "name": "Computer Vision",
        "description": "Computer Vision is a field of AI that trains computers to interpret and understand the visual world.",
        "subtopics": [
            "Image Classification",
            "Object Detection",
            "Image Segmentation"
        ]
    },
    "reinforcement-learning": {
        "name": "Reinforcement Learning",
        "description": "Reinforcement Learning is an area of machine learning concerned with how software agents ought to take actions in an environment.",
        "subtopics": [
            "Q-Learning",
            "Deep Q Networks",
            "Policy Gradients"
        ]
    },
    "ethics": {
        "name": "AI Ethics",
        "description": "AI Ethics explores the moral implications of artificial intelligence and its impact on society.",
        "subtopics": [
            "Bias in AI",
            "Privacy Concerns",
            "AI Governance"
        ]
    },
    "applications": {
        "name": "AI Applications",
        "description": "AI Applications covers real-world implementations of artificial intelligence across various industries.",
        "subtopics": [
            "Healthcare AI",
            "Financial AI",
            "Autonomous Systems"
        ]
    }
}

# Load quiz questions from JSON file
def load_quiz_questions():
    try:
        with open('static/js/quiz.json', 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading quiz questions: {str(e)}")
        return {}

TOPIC_QUIZZES = load_quiz_questions()

async def get_together_ai_response(messages):
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://api.together.xyz/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {TOGETHER_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "mistralai/Mixtral-8x7B-Instruct-v0.1",
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 1000
            }
        ) as response:
            if response.status != 200:
                error_text = await response.text()
                raise Exception(f"Together AI API error: {error_text}")
            
            data = await response.json()
            return data["choices"][0]["message"]["content"]

@app.get("/api/progress")
async def get_progress(current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"progress": current_user.get("progress", 0)}

@app.post("/api/update-progress")
async def update_progress(request: Request, current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        data = await request.json()
        new_score = data.get("score", 0)
        
        # Update user's progress in database
        result = await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$set": {"progress": new_score}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update progress")
        
        return {"success": True, "progress": new_score}
    except Exception as e:
        print(f"Error updating progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/update-progress")
async def update_user_progress(user_id, topic, score=1):
    # Get current progress
    user = await db.users.find_one({"_id": user_id})
    if not user:
        return
    
    # Initialize progress if not exists
    if not isinstance(user.get("progress"), dict):
        user["progress"] = {}
    
    if topic not in user["progress"]:
        user["progress"][topic] = 0
    
    # If score is a quiz score (number of correct answers)
    if isinstance(score, (int, float)) and score > 1:
        # Get total questions for the topic
        topic_quizzes = TOPIC_QUIZZES.get(topic, {})
        if topic_quizzes and "questions" in topic_quizzes:
            total_questions = len(topic_quizzes["questions"])
            # Calculate percentage
            percentage = (score / total_questions) * 100
            
            # Update progress based on percentage
            if percentage == 100:  # All correct
                user["progress"][topic] = min(100, user["progress"][topic] + 10)
            elif percentage >= 60:  # Above 60%
                user["progress"][topic] = min(100, user["progress"][topic] + 3)
            else:  # Below 60%
                user["progress"][topic] = min(100, user["progress"][topic] + 1)
    else:
        # For regular interactions (questions asked, etc.)
        user["progress"][topic] = min(100, user["progress"][topic] + score)
    
    # Calculate total progress by summing all topic progress values
    total_progress = sum(progress for progress in user["progress"].values() if isinstance(progress, (int, float)))
    total_topics = len(user["progress"])
    average_progress = total_progress / total_topics if total_topics > 0 else 0
    
    # Update level based on progress
    if average_progress >= 100:
        user["level"] = "advanced"
    elif average_progress >= 50:
        user["level"] = "intermediate"
    else:
        user["level"] = "beginner"
    
    # Update user in database
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {
            "progress": user["progress"],
            "level": user.get("level", "beginner")
        }}
    )
    
    return user["progress"]

@app.get("/api/resources")
async def get_resources(topic: str = None, subtopic: str = None):
    try:
        with open('static/js/resources.json', 'r') as f:
            resources = json.load(f)
            
        if topic:
            if topic in resources:
                if subtopic and subtopic in resources[topic].get('subtopics', {}):
                    selected_resources = resources[topic]['subtopics'][subtopic]['resources']
                else:
                    selected_resources = resources[topic]['resources']
            else:
                selected_resources = []
        else:
            selected_resources = []
            for topic_resources in resources.values():
                selected_resources.extend(topic_resources.get('resources', []))
                for subtopic_resources in topic_resources.get('subtopics', {}).values():
                    selected_resources.extend(subtopic_resources.get('resources', []))
        
        messages = []
        for r in selected_resources:
            messages.append({
                "response": f"<a href='{r['url']}' target='_blank'>{r['title']}</a>",
                "is_resource": True,
                "is_html": True
            })
        
        return {"resources": messages}
    except Exception as e:
        print(f"Error loading resources: {str(e)}")
        return {"resources": []}

@app.post("/api/chat")
async def chat(request: Request, current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    data = await request.json()
    message = data.get("message")
    topic = data.get("topic")
    
    if not topic:
        raise HTTPException(status_code=400, detail="Topic is required")
    
    # If no message is provided, return topic introduction
    if not message:
        topic_info = TOPICS.get(topic)
        if not topic_info:
            raise HTTPException(status_code=400, detail="Invalid topic")
        
        # Get brief explanation from Together AI
        response = await get_together_ai_response([
            {"role": "system", "content": "You are an AI tutor. Provide a very brief, engaging explanation of the topic in 1-2 sentences. Keep it simple and interesting."},
            {"role": "user", "content": f"Explain {topic_info['name']} in a simple way that a beginner can understand."}
        ])
        
        return {
            "response": f"{response}\n\nHere are some subtopics you can explore under {topic_info['name']}:\n" + 
                       "\n".join([f"- {subtopic}" for subtopic in topic_info['subtopics']]),
            "subtopics": topic_info["subtopics"]
        }
    
    # Common AI-related keywords for broader topic detection
    ai_keywords = [
        'ai', 'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
        'algorithm', 'model', 'training', 'dataset', 'data', 'learn', 'predict', 'classification',
        'regression', 'clustering', 'nlp', 'computer vision', 'robotics', 'automation',
        'supervised', 'unsupervised', 'reinforcement', 'ethics', 'bias', 'framework',
        'python', 'tensorflow', 'pytorch', 'keras', 'scikit', 'opencv', 'roadmap', 'career',
        'course', 'study', 'guide', 'path', 'recommendation', 'project', 'application'
    ]
    
    message_lower = message.lower()
    topic_info = TOPICS.get(topic, {})
    
    # Check if the message contains any AI-related keywords
    is_ai_related = any(keyword in message_lower for keyword in ai_keywords)
    
    # If not AI-related, check if it might be a general question about learning AI
    if not is_ai_related and ('how' in message_lower or 'what' in message_lower or 'why' in message_lower or 'where' in message_lower):
        # Get Together AI to classify if the question is about learning/understanding AI
        classify_response = await get_together_ai_response([
            {"role": "system", "content": "You are a classifier. Respond with 'yes' if the question is about learning, understanding, or working with AI/ML/Data Science, otherwise respond with 'no'."},
            {"role": "user", "content": message}
        ])
        is_ai_related = 'yes' in classify_response.lower()
    
    # If still not AI-related, return the generic response
    if not is_ai_related:
        return {
            "response": "I am an AI learning assistant. Please ask me questions related to artificial intelligence. I can help you with AI concepts, learning resources, career guidance, technical details, or any other AI-related topics."
        }
    
    # For AI-related questions, get response from Together AI with a more flexible system prompt
    response = await get_together_ai_response([
        {"role": "system", "content": """You are an AI tutor with expertise in all areas of artificial intelligence. 
        Provide helpful, accurate, and educational responses about any AI-related topic, including but not limited to:
        - Technical concepts and explanations
        - Learning resources and roadmaps
        - Career guidance and industry trends
        - Practical applications and real-world examples
        - Best practices and recommendations
        Keep responses focused on AI and related fields."""},
        {"role": "user", "content": message}
    ])
    
    return {"response": response}

# Progress endpoint
@app.get("/api/progress")
async def get_progress(current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return {
        "progress": current_user.get("progress", {}),
        "level": current_user.get("level", "beginner")
    }

# History endpoint
@app.get("/api/history")
async def get_history(request: Request):
    try:
        user_id = request.headers.get("user-id") or request.query_params.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID required")
        
        print(f"Fetching history for user_id: {user_id}")
        
        # Get chat history from database, sorted by timestamp (newest first)
        cursor = db.chats.find({"user_id": user_id}).sort("timestamp", -1)
        history = []
        
        async for chat in cursor:
            # Convert ObjectId to string
            chat["_id"] = str(chat["_id"])
            chat["timestamp"] = chat["timestamp"].strftime("%Y-%m-%d %H:%M:%S")
            
            # Get preview from first message if available
            if chat.get("messages") and len(chat["messages"]) > 0:
                preview = chat["messages"][0].get("content", "")[:50]
                chat["preview"] = preview + "..." if len(preview) >= 50 else preview
            else:
                chat["preview"] = "Empty chat"
            
            history.append(chat)
            print(f"Found chat - ID: {chat['_id']}, Topic: {chat.get('topic', 'Untitled')}")
        
        print(f"Returning {len(history)} chats")
        return {"history": history}
    
    except Exception as e:
        print(f"Error getting history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/{chat_id}")
async def get_chat(chat_id: str, request: Request):
    try:
        user_id = request.session.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        # Get the chat from database
        chat = await db.chats.find_one({
            "_id": ObjectId(chat_id),
            "user_id": user_id
        })
        
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Convert ObjectId to string
        chat["_id"] = str(chat["_id"])
        chat["timestamp"] = chat["timestamp"].strftime("%Y-%m-%d %H:%M:%S")
        
        return {
            "topic": chat["topic"],
            "messages": chat["messages"]
        }
    except Exception as e:
        print(f"Error loading chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/save-chat")
async def save_chat(request: Request):
    try:
        data = await request.json()
        user_id = request.headers.get("user-id") or data.get("user_id")
        
        if not user_id:
            print("No user_id provided")
            raise HTTPException(status_code=401, detail="User ID required")
        
        print(f"Saving chat for user_id: {user_id}")
        
        # Create chat document with all content preserved
        chat = {
            "user_id": user_id,
            "topic": data["topic"],
            "messages": data["messages"],  # Contains HTML content
            "quiz_state": data.get("quiz_state"),  # Save quiz state if present
            "timestamp": datetime.now()
        }
        
        # Get preview from first message if available
        if chat["messages"] and len(chat["messages"]) > 0:
            # Strip HTML tags for preview
            preview = re.sub('<[^<]+?>', '', chat["messages"][0]["content"])
            chat["preview"] = preview[:50] + "..." if len(preview) > 50 else preview
        
        # Save to MongoDB
        result = await db.chats.insert_one(chat)
        
        # Get the saved chat
        saved_chat = await db.chats.find_one({"_id": result.inserted_id})
        
        # Convert ObjectId and datetime to string for JSON response
        saved_chat["_id"] = str(saved_chat["_id"])
        saved_chat["timestamp"] = saved_chat["timestamp"].strftime("%Y-%m-%d %H:%M:%S")
        
        print(f"Successfully saved chat with {len(chat['messages'])} messages")
        return {
            "success": True,
            "chat": saved_chat
        }
    except Exception as e:
        print(f"Error saving chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/get-chats")
async def get_chats(request: Request):
    try:
        user_id = request.headers.get("user-id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID required")
        
        # Get all chats for the user, sorted by timestamp descending
        cursor = db.chats.find({"user_id": user_id}).sort("timestamp", -1)
        chats = []
        
        async for chat in cursor:
            # Convert ObjectId and datetime to string
            chat["_id"] = str(chat["_id"])
            chat["timestamp"] = chat["timestamp"].strftime("%Y-%m-%d %H:%M:%S")
            chats.append(chat)
        
        return {
            "success": True,
            "chats": chats
        }
    except Exception as e:
        print(f"Error getting chats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def detect_resource_intent(message: str) -> bool:
    if not message:
        return False
    
    # Get Together AI response for intent detection
    response = await get_together_ai_response([
        {"role": "system", "content": "You are an intent classifier. Determine if the user is asking for resources, materials, or learning materials. Respond with 'yes' or 'no' only."},
        {"role": "user", "content": f"Does this message indicate the user wants resources or learning materials? Message: {message}"}
    ])
    
    # Check if the response indicates a resource request
    return "yes" in response.lower()

