# Nurmed Frontend

## Project Overview

Nurmed is a healthcare management system built with Next.js 15 and React 19. The application provides a comprehensive platform for healthcare professionals to manage patient sessions, record audio consultations, and generate medical documentation through AI-powered features.

### Core Functionality

- **Authentication System**: Multi-factor authentication with OTP verification
- **Audio Recording**: Real-time audio recording and playback capabilities
- **Session Management**: Create and manage patient consultation sessions
- **AI Integration**: AI-powered features for medical documentation and coding suggestions
- **EHR Integration**: Electronic Health Record (EHR) management
- **Responsive Design**: Mobile-first design with Tailwind CSS

## Project Structure

```
nurmed-frontend/
├── app/                          # Next.js App Router directory
│   ├── (pages)/                  # Route groups for better organization
│   │   ├── (auth)/              # Authentication pages
│   │   │   ├── login/           # Login page
│   │   │   ├── forgot-password/ # Password recovery
│   │   │   ├── verify-otp/      # OTP verification
│   │   │   └── reset-password/  # Password reset
│   │   └── (dashboard)/         # Main application pages
│   │       ├── page.tsx         # Dashboard home
│   │       └── session/[id]/    # Individual session pages
│   ├── components/              # Reusable UI components
│   │   ├── Dashboard/           # Dashboard-specific components
│   │   ├── Modal/              # Modal components
│   │   └── index.tsx           # Component exports
│   ├── contexts/               # React Context providers
│   │   ├── AuthContext.tsx     # Authentication state management
│   │   ├── SessionContext.tsx  # Session state management
│   │   └── UIStateContext.tsx  # UI state management
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAudioRecorder.ts # Audio recording functionality
│   │   ├── useSession.ts       # Session management
│   │   └── useFormHook.tsx     # Form handling
│   ├── kyClient/               # API client configuration
│   │   ├── api.ts              # Base API service
│   │   ├── auth.ts             # Authentication API
│   │   ├── dashboard.ts        # Dashboard API endpoints
│   │   └── constants.ts        # API constants and types
│   └── globals.css             # Global styles
├── public/                     # Static assets
│   └── images/                 # Image assets
├── middleware.ts               # Next.js middleware
├── next.config.ts             # Next.js configuration
├── tailwind.config.js         # Tailwind CSS configuration
├── package.json               # Dependencies and scripts
└── tsconfig.json             # TypeScript configuration
```

### Key Directories Explained

- **`app/(pages)/`**: Route groups for better organization of pages
- **`app/components/`**: Reusable UI components organized by feature
- **`app/contexts/`**: React Context providers for state management
- **`app/hooks/`**: Custom React hooks for business logic
- **`app/kyClient/`**: API client using Ky library for HTTP requests
- **`public/`**: Static assets like images and icons

## Setup Instructions

### Prerequisites

- **Node.js**: Version 18.17 or higher
- **Package Manager**: pnpm (recommended), npm, or yarn
- **Git**: For version control

### Required Dependencies

The project uses the following key dependencies:

#### Production Dependencies

- `next`: 15.2.2 - React framework
- `react`: ^19.0.0 - React library
- `react-dom`: ^19.0.0 - React DOM
- `ky`: ^1.7.5 - HTTP client
- `crypto-js`: ^4.2.0 - Encryption utilities
- `formik`: ^2.4.6 - Form management
- `react-hook-form`: ^7.54.2 - Alternative form handling
- `yup`: ^1.6.1 - Schema validation
- `js-cookie`: ^3.0.5 - Cookie management
- `react-hot-toast`: ^2.5.2 - Toast notifications

#### Development Dependencies

- `typescript`: ^5 - TypeScript compiler
- `tailwindcss`: ^3.4.17 - CSS framework
- `autoprefixer`: ^10.4.21 - CSS autoprefixer
- `postcss`: ^8.5.3 - CSS post-processor
- `prettier`: ^3.5.3 - Code formatting
- `@types/*`: TypeScript type definitions

### Installation Steps

1. **Clone the repository**:

   ```bash
   git clone https://github.com/Nurmed-ai/nurmed-frontend.git
   cd nurmed-frontend
   ```

2. **Install dependencies**:

   ```bash
   # Using pnpm (recommended)
   pnpm install

   # Or using npm
   npm install

   # Or using yarn
   yarn install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   Then edit `.env.local` with your configuration (see Environment Configuration section).

## Run Instructions

### Development Mode

Start the development server with hot reload:

```bash
# Using pnpm
pnpm dev

# Using npm
npm run dev

# Using yarn
yarn dev
```

The application will be available at `http://localhost:3000`

### Available Scripts

- `dev`: Start development server with Turbopack
- `build`: Build the application for production
- `start`: Start the production server
- `lint`: Run ESLint for code linting

### Production Build

```bash
# Build the application
pnpm build

# Start production server
pnpm start
```

## Environment Configuration

### Required Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# API Configuration
NEXT_PUBLIC_API_BASE_URL=api-base-url

# Authentication
NEXT_PUBLIC_ENCRYPTION_KEY=your-encryption-key

### Environment Variables Explained

- `NEXT_PUBLIC_API_BASE_URL`: Base URL for the backend API
- `NEXT_PUBLIC_ENCRYPTION_KEY`: Authentication encryption Key

### Sample .env.example

```env
# API Configuration
NEXT_PUBLIC_API_BASE_URL=api-base-url

# Authentication
NEXT_PUBLIC_ENCRYPTION_KEY=your-encryption-key
```

## Additional Notes

### Architecture Patterns

- **App Router**: Uses Next.js 15 App Router for file-based routing
- **Context API**: State management using React Context for authentication, sessions, and UI state
- **Custom Hooks**: Business logic encapsulated in custom React hooks
- **API Client**: Centralized API client using Ky library with automatic token refresh
- **TypeScript**: Full TypeScript implementation for type safety

### Key Features

1. **Authentication Flow**:

   - Email/password login with OTP verification
   - Password reset functionality
   - Automatic token refresh
   - Session persistence

2. **Audio Recording**:

   - Real-time audio recording
   - Audio playback and preview
   - Pause/resume functionality
   - Audio encryption/decryption

3. **Session Management**:

   - Create new patient sessions
   - View session history
   - Session-specific data management

4. **AI Integration**:
   - AI-powered medical documentation
   - Coding suggestions
   - Copilot AI features

### Development Guidelines

1. **Code Style**: Uses Prettier for code formatting
2. **TypeScript**: Strict TypeScript configuration
3. **Component Structure**: Functional components with hooks
4. **State Management**: Context API for global state, local state for component-specific data
5. **API Calls**: Centralized through Ky client with error handling

### Deployment Considerations

- **Build Optimization**: Uses Next.js built-in optimizations
- **Static Assets**: Properly configured for static file serving
- **Environment Variables**: Client-side variables prefixed with `NEXT_PUBLIC_`
- **Security**: Implements secure cookie handling and token management

### Troubleshooting

1. **Port Conflicts**: If port 3000 is in use, Next.js will automatically use the next available port
2. **TypeScript Errors**: Run `pnpm lint` to check for type errors
3. **Build Issues**: Clear `.next` folder and node_modules, then reinstall dependencies
4. **API Connection**: Ensure `NEXT_PUBLIC_API_BASE_URL` is correctly configured

### Performance Considerations

- **Image Optimization**: Uses Next.js Image component for optimized images
- **Code Splitting**: Automatic code splitting by Next.js
- **Bundle Analysis**: Use `pnpm build` to analyze bundle size
- **Caching**: Implements proper caching strategies for API responses
- 
