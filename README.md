# 📋 FeedbackPDF - Advanced PDF Survey Extractor

A powerful, AI-driven application for extracting and analyzing survey data from PDF documents with intelligent OCR and form detection capabilities.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)

## 🚀 Features

### 📄 PDF Processing
- **Intelligent Form Detection**: Automatically detects and separates multiple survey forms from single PDF files
- **OpenAI GPT-4 Integration**: Advanced text extraction and understanding
- **OCR with Vision API**: Processes scanned documents and handwritten forms
- **Multi-language Support**: Configurable OCR language settings
- **Batch Processing**: Handle multiple PDF files simultaneously

### 🎯 Survey Analysis
- **Structured Data Extraction**: Automatically extracts:
  - Likert scale ratings (1-5)
  - Recommendation scores (0-10)
  - Open-ended text responses
  - Contact information (names, companies, emails, phones)
  - Course evaluation metrics

### 📊 Data Visualization
- **Interactive Dashboard**: Real-time statistics and analytics
- **Response Management**: View, search, filter, and sort extracted data
- **Export Capabilities**: CSV export for further analysis
- **Visual Indicators**: Color-coded ratings and completion status

### 🤖 AI Assistant
- **Intelligent Chat**: Ask questions about your survey data
- **Context-Aware**: Analyzes specific courses or overall trends
- **Natural Language**: Get insights in plain English
- **Data-Driven Responses**: Backed by actual survey data

### 🔐 Security & Authentication
- **Supabase Auth**: Secure user authentication and authorization
- **Row Level Security**: Users can only access their own data
- **Encrypted Storage**: Secure API key storage
- **File Security**: Private PDF storage with access controls

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for modern styling
- **Lucide React** for beautiful icons
- **React Router** for navigation
- **React Hot Toast** for notifications

### Backend
- **Supabase** for database, authentication, and storage
- **PostgreSQL** for robust data storage
- **Row Level Security (RLS)** for data isolation
- **Edge Functions** for serverless processing

### AI Integration
- **OpenAI GPT-4** for intelligent text processing
- **OpenAI Vision API** for OCR and image analysis
- **Custom prompts** optimized for survey data extraction

### Processing Engine
- **PDF.js** for PDF parsing and rendering
- **Canvas API** for image conversion
- **Advanced regex patterns** for form detection
- **Intelligent fallback systems**

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- OpenAI API key

### 1. Clone the Repository
```bash
git clone https://github.com/Tiagocruz3/FeedbackPDF.git
cd FeedbackPDF
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Database Setup
1. Create a new Supabase project
2. Run the migrations from `supabase/migrations/` folder
3. Set up storage bucket for PDF files

### 5. Start Development Server
```bash
npm run dev
```

## ⚙️ Configuration

### OpenAI Setup
1. Navigate to Settings in the application
2. Enter your OpenAI API key
3. Select your preferred model (gpt-4o recommended)
4. Test the connection
5. Save settings

### Processing Options
- **OCR Language**: Configure for different languages
- **Confidence Threshold**: Adjust for accuracy vs coverage
- **Auto Retry**: Enable automatic retry on failures
- **Processing Timeout**: Set maximum processing time

## 📋 Usage

### 1. Upload PDFs
- Enter a course name
- Drag and drop or select PDF files
- Monitor processing progress
- View results in the dashboard

### 2. Analyze Data
- Navigate to uploaded course data
- View extracted survey responses
- Use search and filter options
- Export data as CSV

### 3. AI Assistant
- Open the AI chat interface
- Ask questions about your data
- Get insights and analysis
- Context-aware responses

## 🎯 Supported Survey Types

The system is optimized for course evaluation surveys with:
- **Rating Questions**: 1-5 Likert scales, 0-10 recommendation scores
- **Text Responses**: Comments, suggestions, learnings
- **Contact Information**: Names, companies, emails, phones
- **Multiple Formats**: Digital PDFs, scanned documents, mixed content

## 🏗️ Architecture

### Frontend Architecture
```
src/
├── components/          # React components
│   ├── Auth.tsx        # Authentication
│   ├── Dashboard.tsx   # Main dashboard
│   ├── Upload.tsx      # File upload interface
│   ├── ResponsesView.tsx # Data visualization
│   ├── Settings.tsx    # Configuration
│   └── AIChat.tsx      # AI assistant
├── lib/
│   └── supabase.ts     # Supabase client
└── App.tsx             # Main application
```

### Backend Architecture
```
supabase/
├── functions/          # Edge functions
│   ├── process-pdf/    # PDF processing engine
│   ├── ai-chat/        # AI assistant backend
│   └── test-openai/    # API testing
└── migrations/         # Database schema
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for providing powerful AI models
- Supabase for the excellent backend-as-a-service platform
- The React and TypeScript communities
- PDF.js for robust PDF processing capabilities

## 📞 Support

For support, email support@feedbackpdf.com or create an issue in this repository.

---

**Built with ❤️ by [Tiagocruz3](https://github.com/Tiagocruz3)** 