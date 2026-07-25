# PrepForge

**PrepForge** is a full-stack AI-powered mock interview platform built to help students prepare for technical and behavioral interviews through realistic interview simulations.

Unlike traditional interview preparation platforms that rely on static question banks, PrepForge dynamically generates role-specific interview questions, asks context-aware follow-up questions based on the candidate's responses, and provides detailed AI-driven feedback on technical accuracy, communication clarity, and answer completeness.

The platform also supports custom company question banks, allowing users to practice with real interview questions collected from sources such as Glassdoor while still receiving adaptive AI follow-up questions and detailed evaluations.

---

## 🌐 Live Demo

**Website:** https://prepforge-delta.vercel.app/

---

## 🚀 Features

### 🤖 AI Interview Engine

* Dynamic HR, Technical, and Communication interview modes
* Role-specific interview generation (e.g. Software Engineer, Backend Developer, Data Analyst)
* Adaptive AI follow-up questions based on previous responses
* Multi-topic technical interviews (DSA, DBMS, OS, OOPs, CN)
* Difficulty-based interview generation
* Intelligent evaluation after every interview

---

### 🎯 Interview Experience

* Voice and text answer support
* Difficulty-based countdown timer
* Automatic answer submission when time expires
* Context-aware follow-up questioning
* AI-generated ideal answers for comparison
* Downloadable PDF interview reports

---

### 📚 Custom Question Bank

* Create multiple question sets
* Import hundreds of interview questions at once
* Edit, rename, or delete question sets
* Randomize questions during every interview session
* Continue using the complete AI evaluation pipeline with custom questions

---

### 📊 Dashboard & Analytics

* Interview history
* Overall readiness score
* Subject-wise performance breakdown
* Radar chart for strengths and weaknesses
* Score trend visualization
* Activity heatmap
* Performance tracking across multiple interview sessions

---

### 🔒 Authentication & Security

* Google OAuth authentication
* Supabase Row Level Security (RLS)
* Secure server-side AI requests through Vercel Serverless Functions
* No API keys exposed to the client

---

## 🛠 Tech Stack

| Category       | Technology                               |
| -------------- | ---------------------------------------- |
| Frontend       | React (Vite), Tailwind CSS, React Router |
| Backend        | Vercel Serverless Functions (Node.js)    |
| Database       | Supabase PostgreSQL                      |
| Authentication | Supabase Auth (Google OAuth)             |
| AI Model       | Groq API (Llama-3.3-70B-Versatile)       |
| Charts         | Recharts                                 |
| Browser APIs   | Web Speech API, AbortController          |
| Deployment     | Vercel                                   |

> **Note:** The project originally used Gemini but was later migrated to Groq for lower latency, faster inference, and more reliable rate limits.

---

# 🏗 System Architecture

```text
                        Google OAuth
                              │
                              ▼
                      Supabase Authentication
                              │
                              ▼
                    React + Vite Frontend
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
          ▼                                       ▼
  Supabase Database                    Vercel Serverless API
(PostgreSQL + RLS)                             (/api/ai)
          │                                       │
          │                                       ▼
          └──────────────► Groq Llama 3.3 ◄────────┘
```

---

# 🔄 Application Flow

### 1. Authentication

Users sign in using Google OAuth through Supabase.

After successful authentication:

* A JWT is issued
* User information is stored in PostgreSQL
* Row Level Security ensures users can only access their own interview data

---

### 2. Interview Setup

Users configure:

* Interview type
* Target role
* Technical subjects
* Difficulty level

The frontend sends this configuration along with the authenticated JWT to a secure Vercel Serverless Function.

The backend then:

* validates the user
* builds the interview prompt
* requests interview questions from Groq
* validates the response format
* returns structured interview questions

---

### 3. Interview Session

Candidates answer questions using either:

* Text
* Voice (Web Speech API)

Each submitted response generates an AI follow-up question that explores reasoning, assumptions, or missing details rather than simply asking the next predefined question.

---

### 4. AI Evaluation

After the interview ends:

The complete transcript is evaluated for:

* Technical accuracy
* Communication clarity
* Answer completeness
* Interview readiness

The generated report includes:

* Overall score
* Question-by-question analysis
* Strengths
* Areas for improvement
* AI-generated ideal answers

---

### 5. Data Persistence

Interview results are asynchronously saved to Supabase.

The dashboard is automatically updated with:

* New interview history
* Progress graphs
* Readiness score
* Performance trends

---

# ⚙ Technical Challenges & Solutions

## 1. Supabase Authentication Deadlock

### Problem

User records occasionally failed to save after login, causing requests to hang until the serverless timeout.

### Root Cause

A database write was awaited inside Supabase's `onAuthStateChange()` callback, creating a deadlock with the authentication connection.

### Solution

The database write was deferred using:

```javascript
setTimeout(() => {
  saveUser(...)
}, 0)
```

Moving the operation to the next event loop cycle eliminated the deadlock.

---

## 2. API Security

### Problem

Early versions exposed the AI API key in the frontend.

### Solution

All AI requests were migrated to Vercel Serverless Functions.

Benefits:

* API keys remain server-side
* Frontend communicates only with internal endpoints
* User authentication is validated before every AI request

---

## 3. API Timeouts & Rate Limits

### Problem

Large evaluation requests occasionally stalled or exceeded free-tier API limits.

### Solution

Implemented:

* `AbortController` with a 30-second timeout
* Exponential backoff retry logic
* Automatic retries for HTTP **429** and **503** responses

This improved reliability during temporary API failures.

---

## 4. React StrictMode Race Conditions

### Problem

React StrictMode executed effects twice during development, resulting in duplicate database writes.

### Solution

A `useRef` guard (`hasLoaded.current`) prevents duplicate execution and eliminates concurrent write conflicts.

---

## 5. AI Token Optimization

### Problem

Very short or accidental responses unnecessarily consumed AI tokens.

### Solution

Responses shorter than 10 characters are validated locally and scored without invoking the LLM, reducing unnecessary API usage and improving response times.

---

# 📂 Project Structure

```text
PrepForge/
│
├── api/                     # Vercel Serverless Functions
├── public/
├── src/
│   ├── components/
│   ├── context/
│   ├── hooks/
│   ├── lib/
│   └── pages/
│
├── supabase/
├── package.json
└── README.md
```

---

# 📦 Local Setup

## Clone the Repository

```bash
git clone https://github.com/IshitaBhadoriya/prepAI.git
cd prepAI
```

## Install Dependencies

```bash
npm install
```

## Configure Environment Variables

Create a `.env` file in the project root.

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
GROQ_API_KEY=your_groq_api_key
```

## Run the Development Server

```bash
npm run dev
```

---

# 🎯 Project Goals

* Simulate realistic technical and behavioral interviews
* Generate adaptive AI follow-up questions
* Provide actionable interview feedback
* Help students improve technical knowledge and communication skills
* Track interview progress over time
* Support practice using custom company question banks
* Demonstrate modern full-stack engineering practices through a production-ready application

---

# 🚀 Future Improvements

* Resume-based interview generation
* Integrated DSA coding editor
* Video-based interview analysis
* Multi-round interview simulations
* Semantic search for custom question banks using pgvector
* Company-specific interview preparation paths


