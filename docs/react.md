# React Project Structure & Best Practices Checklist

## 1. PROJECT ARCHITECTURE PHILOSOPHY

### Decomposition Over Monolith

- **Approach**: Think of your project as composed of independent features/packages rather than a monolith
- **Benefit**: Teams can work independently; features are isolated "black boxes" that communicate via props
- **Implementation**: Use monorepo architecture with multi-package structure for large projects

### Feature-Based Organization

- Group related code by **feature** or **domain**, not by file type
- Each feature should have clear boundaries, ideally visible in the UI
- Extract features into packages when they become shareable or isolated

---

## 2. DIRECTORY STRUCTURE

### Small to Medium Projects

```
src/
├── components/
│   ├── Button/
│   │   ├── index.ts
│   │   ├── Button.tsx
│   │   ├── Button.test.ts
│   │   ├── Button.styles.tsx
│   │   └── types.ts
│   ├── Modal/
│   └── ...
├── pages/
│   ├── HomePage/
│   │   ├── index.ts
│   │   ├── HomePage.tsx
│   │   └── components/
│   │       └── HeroSection/
│   └── ProfilePage/
├── hooks/
│   ├── useMediaQuery/
│   │   ├── index.ts
│   │   ├── useMediaQuery.ts
│   │   └── useMediaQuery.test.ts
│   ├── useFormValidation/
│   └── ...
├── context/
│   ├── ThemeContext/
│   │   ├── index.ts
│   │   ├── ThemeContext.ts
│   │   └── ThemeProvider.tsx
│   ├── AuthContext/
│   └── ...
├── services/
│   ├── api/
│   │   ├── apiClient.ts
│   │   ├── users.ts
│   │   ├── posts.ts
│   │   └── types.ts
│   ├── localStorage.ts
│   └── ...
├── utils/
│   ├── formatters.ts
│   ├── validators.ts
│   └── helpers.ts
├── assets/
│   ├── images/
│   ├── icons/
│   └── fonts/
├── types/
│   ├── global.ts
│   ├── api.ts
│   └── models.ts
├── App.tsx
└── index.tsx
```

### Large/Enterprise Projects (Feature-Based)

```
src/
├── app/
│   ├── App.tsx
│   └── App.test.tsx
├── features/
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── context/
│   │   ├── types/
│   │   └── index.ts
│   ├── posts/
│   │   ├── pages/
│   │   ├── components/
│   │   │   ├── PostList/
│   │   │   ├── PostCard/
│   │   │   └── PostForm/
│   │   ├── hooks/
│   │   │   ├── usePost.ts
│   │   │   └── usePosts.ts
│   │   ├── services/
│   │   │   ├── postApi.ts
│   │   │   └── postProcessor.ts
│   │   ├── types/
│   │   │   └── post.types.ts
│   │   ├── context/
│   │   └── index.ts
│   └── comments/
├── shared/
│   ├── components/
│   │   └── Button/
│   ├── hooks/
│   │   └── useDebounce/
│   ├── utils/
│   ├── types/
│   └── services/
├── config/
│   ├── env.ts
│   ├── api.config.ts
│   └── constants.ts
├── assets/
└── index.tsx
```

---

## 3. COMPONENTS

### Naming Convention

- ✅ **PascalCase** for component files and exports: `Button.tsx`, `UserProfile.tsx`
- ✅ Use kebab-case for folder names: `user-profile/`
- ❌ Don't mix naming styles

### Structure Per Component

```typescript
// components/Button/index.ts
export { Button } from "./Button";
export type { ButtonProps } from "./types";

// components/Button/types.ts
export interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}

// components/Button/Button.tsx
import React from "react";
import type { ButtonProps } from "./types";
import * as S from "./Button.styles";

export const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  variant = "primary",
  disabled = false,
}) => (
  <S.StyledButton onClick={onClick} variant={variant} disabled={disabled}>
    {label}
  </S.StyledButton>
);

// components/Button/Button.styles.tsx
import styled from "styled-components";

export const StyledButton = styled.button<{ variant: string }>`
  padding: 8px 16px;
  background: ${(props) =>
    props.variant === "primary" ? "#007bff" : "#6c757d"};
`;

// components/Button/Button.test.tsx
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders with label", () => {
    render(<Button label="Click me" onClick={() => {}} />);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });
});
```

### Component Classification

**Presentational Components** (Pure UI, no business logic)

```typescript
// components/Badge/Badge.tsx
interface BadgeProps {
  label: string;
  color?: string;
}

export const Badge: React.FC<BadgeProps> = ({ label, color = "gray" }) => (
  <span style={{ background: color, padding: "4px 8px" }}>{label}</span>
);
```

**Container Components** (Business logic, data fetching, state)

```typescript
// features/posts/components/PostListContainer/PostListContainer.tsx
import { useState, useEffect } from "react";
import { usePosts } from "../../hooks/usePosts";
import { PostList } from "../PostList/PostList";

export const PostListContainer: React.FC = () => {
  const { posts, loading, error } = usePosts();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return <PostList posts={posts} />;
};
```

### Component Hierarchy Rules

- **Only** main component files (`index.ts`) can import sub-components
- Import only from **children**, never from siblings
- Don't skip levels in the hierarchy
- Maximum nesting: 3-4 levels

```
pages/
└── UserProfile/
    ├── index.ts
    ├── UserProfile.tsx
    └── shared/
        ├── ProfileHeader.tsx
        └── ProfileStats.tsx
```

### Component Best Practices Checklist

- ✅ Components are small and focused (single responsibility)
- ✅ Props are properly typed (TypeScript)
- ✅ Components are pure (deterministic output for same props)
- ✅ No side effects in render path
- ✅ Complex components extracted into custom hooks
- ✅ All props validated/typed
- ✅ Accessibility props included (`aria-*`, `role`)

---

## 4. HOOKS

### Naming Convention

- ✅ Start with `use` prefix: `useMediaQuery`, `useFetch`, `useFormValidation`
- ❌ Don't name hooks without `use` prefix

### Hook Organization

```
src/
├── hooks/
│   ├── useMediaQuery/
│   │   ├── index.ts
│   │   ├── useMediaQuery.ts
│   │   └── useMediaQuery.test.ts
│   ├── useFormValidation/
│   ├── useDebounce.ts          # Simple, single file
│   └── index.ts                # Re-export all hooks
```

### Custom Hook Structure

```typescript
// hooks/useFormValidation/useFormValidation.ts
import { useState, useCallback } from "react";

interface ValidationRules {
  [field: string]: (value: string) => string | null;
}

export const useFormValidation = (
  initialValues: Record<string, string>,
  rules: ValidationRules
) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const validate = useCallback(
    (field: string, value: string) => {
      const error = rules[field]?.(value) || null;
      setErrors((prev) => ({ ...prev, [field]: error }));
      return error;
    },
    [rules]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setValues((prev) => ({ ...prev, [name]: value }));
      validate(name, value);
    },
    [validate]
  );

  return { values, errors, handleChange, setValues };
};

// hooks/useFormValidation/index.ts
export { useFormValidation } from "./useFormValidation";
export type { ValidationRules } from "./useFormValidation";
```

### Hook Best Practices Checklist

- ✅ Hooks only called at top level (never in loops, conditions, or nested functions)
- ✅ All dependencies in dependency array specified
- ✅ Encapsulates **one piece of logic** per hook
- ✅ Minimal state management within hook
- ✅ Clear, descriptive names
- ✅ Well-documented with JSDoc comments
- ✅ Unit tested with React Testing Library or similar
- ✅ Custom hooks are pure (no side effects except `useEffect`)

---

## 5. CONTEXT API

### Context Placement

```
src/
├── context/
│   ├── ThemeContext/
│   │   ├── index.ts
│   │   ├── ThemeContext.ts
│   │   └── ThemeProvider.tsx
│   ├── AuthContext/
│   │   ├── index.ts
│   │   ├── AuthContext.ts
│   │   └── AuthProvider.tsx
│   └── index.ts
```

### Context Structure

```typescript
// context/ThemeContext/ThemeContext.ts
import { createContext } from "react";

export type Theme = "light" | "dark";

export interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined
);

// context/ThemeContext/ThemeProvider.tsx
import React, { useState, useCallback } from "react";
import { ThemeContext, type Theme } from "./ThemeContext";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setTheme] = useState<Theme>("light");

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// context/ThemeContext/index.ts
export { ThemeContext, ThemeProvider } from "./ThemeContext";
export type { Theme, ThemeContextValue } from "./ThemeContext";

// Custom hook for consuming context
// context/ThemeContext/useTheme.ts
import { useContext } from "react";
import { ThemeContext } from "./ThemeContext";

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
```

### Context Best Practices Checklist

- ✅ One context per **logical concern** (Theme, Auth, Notifications)
- ✅ Always provide **default values** to prevent `undefined` errors
- ✅ **Custom hook wrapper** for consuming context (e.g., `useTheme()`)
- ✅ Error thrown if hook used outside provider
- ✅ Context value kept **small** to prevent unnecessary re-renders
- ✅ Multiple contexts instead of one all-encompassing context
- ✅ Use `useCallback` to memoize context value
- ✅ Frequently changing data stays in **local component state**
- ✅ Provider placed as high in tree as needed

### Anti-Patterns to Avoid

- ❌ Consuming context directly without custom hook wrapper
- ❌ Single massive context with unrelated data
- ❌ Storing frequently-changing values in context
- ❌ No error handling when context is undefined

---

## 6. TYPES & TYPESCRIPT

### Type Organization Strategy

**Approach 1: Global Types** (Small-Medium projects)

```
src/
├── types/
│   ├── index.ts
│   ├── global.ts          # App-wide types
│   ├── api.ts             # API response types
│   ├── models.ts          # Domain models
│   └── entities.ts        # Database entities
```

**Approach 2: Component-Based Types** (Medium-Large projects)

```
components/
├── Button/
│   ├── types.ts           # Button-specific types
│   └── Button.tsx
```

**Approach 3: Feature-Based Types** (Large projects)

```
features/
├── posts/
│   ├── types/
│   │   ├── post.ts
│   │   └── index.ts
│   └── Post.tsx
```

### Type File Examples

```typescript
// types/api.ts
export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// types/models.ts
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: Date;
}

// components/Button/types.ts
import type { PropsWithChildren } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

export interface ButtonProps extends PropsWithChildren {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

// types/index.ts
export type { User, Post } from "./models";
export type { ApiResponse, ApiError } from "./api";
```

### Type Best Practices Checklist

- ✅ Use `interface` for objects/components, `type` for primitives/unions
- ✅ Group related types in same file
- ✅ Export types from barrel files (`index.ts`)
- ✅ Use `Pick<T, Keys>` and `Omit<T, Keys>` to derive types
- ✅ Use `Readonly<T>` for immutable data
- ✅ Create discriminated unions for complex state
- ✅ Avoid `any`; use `unknown` with type guards when necessary
- ✅ Use generic types for reusable patterns

---

## 7. API/SERVICES LAYER

### Service Layer Structure

```
src/
├── services/
│   ├── api/
│   │   ├── apiClient.ts         # Axios/Fetch wrapper
│   │   ├── users.ts             # User API calls
│   │   ├── posts.ts             # Posts API calls
│   │   ├── comments.ts          # Comments API calls
│   │   ├── types.ts             # API response types
│   │   └── index.ts
│   ├── storage/
│   │   └── localStorage.ts
│   └── index.ts
```

### API Client Setup

```typescript
// services/api/apiClient.ts
import axios, { AxiosInstance } from "axios";

class APIClient {
  private client: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request interceptor for adding auth token
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem("authToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized
          localStorage.removeItem("authToken");
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, options?: any): Promise<T> {
    const response = await this.client.get<T>(url, options);
    return response.data;
  }

  async post<T>(url: string, data?: any, options?: any): Promise<T> {
    const response = await this.client.post<T>(url, data, options);
    return response.data;
  }

  async put<T>(url: string, data?: any, options?: any): Promise<T> {
    const response = await this.client.put<T>(url, data, options);
    return response.data;
  }

  async delete<T>(url: string, options?: any): Promise<T> {
    const response = await this.client.delete<T>(url, options);
    return response.data;
  }
}

export const apiClient = new APIClient(
  process.env.REACT_APP_API_BASE_URL || "http://localhost:3000"
);

// services/api/users.ts
import { apiClient } from "./apiClient";
import type { User, ApiResponse } from "../../types";

export const userApi = {
  async getUser(id: string): Promise<User> {
    return apiClient.get(`/users/${id}`);
  },

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    return apiClient.put(`/users/${id}`, data);
  },

  async listUsers(params?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<User[]>> {
    return apiClient.get("/users", { params });
  },

  async createUser(data: Omit<User, "id" | "createdAt">): Promise<User> {
    return apiClient.post("/users", data);
  },

  async deleteUser(id: string): Promise<void> {
    return apiClient.delete(`/users/${id}`);
  },
};

// services/api/index.ts
export { apiClient } from "./apiClient";
export * as userApi from "./users";
export * as postApi from "./posts";
export * as commentApi from "./comments";
export type * from "./types";
```

### Data Fetching with React Query/SWR

```typescript
// hooks/useUser.ts
import { useQuery } from "@tanstack/react-query";
import { userApi } from "../services/api";

export const useUser = (userId: string) => {
  return useQuery({
    queryKey: ["user", userId],
    queryFn: () => userApi.getUser(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
};

// hooks/usePosts.ts
import { useQuery } from "@tanstack/react-query";
import { postApi } from "../services/api";

export const usePosts = (page = 1) => {
  return useQuery({
    queryKey: ["posts", page],
    queryFn: () => postApi.listPosts({ page }),
    staleTime: 3 * 60 * 1000,
  });
};
```

### Service Layer Best Practices Checklist

- ✅ All API calls centralized in service layer
- ✅ API client is a singleton
- ✅ Error handling centralized (interceptors)
- ✅ Request/response types strongly typed
- ✅ Environment-based configuration
- ✅ Retry logic implemented
- ✅ Request/response logging in development
- ✅ Authentication tokens managed automatically
- ✅ Use React Query or SWR for caching/sync
- ✅ Services are pure functions with no side effects

---

## 8. STYLING

### Approach Options

1. **Styled Components** (CSS-in-JS)
2. **CSS Modules** (Scoped CSS)
3. **Tailwind CSS** (Utility-first)
4. **SCSS/SASS** (with BEM methodology)

### Styled Components Pattern

```typescript
// components/Button/Button.styles.ts
import styled from "styled-components";

interface StyledButtonProps {
  variant: "primary" | "secondary";
  size: "sm" | "md" | "lg";
}

export const StyledButton = styled.button<StyledButtonProps>`
  padding: ${(props) => {
    const sizes = { sm: "4px 8px", md: "8px 16px", lg: "12px 24px" };
    return sizes[props.size];
  }};
  background: ${(props) =>
    props.variant === "primary" ? "#007bff" : "#6c757d"};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.3s;

  &:hover {
    opacity: 0.8;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
```

### CSS Modules Pattern

```typescript
// components/Button/Button.module.css
.button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.3s;
}

.primary {
  background: #007bff;
}

.secondary {
  background: #6c757d;
}

// components/Button/Button.tsx
import styles from './Button.module.css';

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', ...props }) => (
  <button className={`${styles.button} ${styles[variant]}`} {...props} />
);
```

---

## 9. STATE MANAGEMENT

### When to Use What

| Scope                   | Solution                     |
| ----------------------- | ---------------------------- |
| Component-level         | `useState`                   |
| Related component group | Custom hook + props drilling |
| Shared across app       | Context API + `useReducer`   |
| Complex async + caching | React Query / SWR            |
| Global + complex        | Redux / Zustand              |

### useReducer Pattern for Complex State

```typescript
// hooks/usePostsReducer.ts
import { useReducer, useCallback } from "react";

interface PostsState {
  posts: Post[];
  loading: boolean;
  error: string | null;
}

type PostsAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: Post[] }
  | { type: "FETCH_ERROR"; payload: string }
  | { type: "ADD_POST"; payload: Post }
  | { type: "DELETE_POST"; payload: string };

const postsReducer = (state: PostsState, action: PostsAction): PostsState => {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_SUCCESS":
      return { ...state, posts: action.payload, loading: false };
    case "FETCH_ERROR":
      return { ...state, error: action.payload, loading: false };
    case "ADD_POST":
      return { ...state, posts: [...state.posts, action.payload] };
    case "DELETE_POST":
      return {
        ...state,
        posts: state.posts.filter((p) => p.id !== action.payload),
      };
    default:
      return state;
  }
};

export const usePostsReducer = () => {
  const [state, dispatch] = useReducer(postsReducer, {
    posts: [],
    loading: false,
    error: null,
  });

  const fetchPosts = useCallback(async () => {
    dispatch({ type: "FETCH_START" });
    try {
      const data = await postApi.listPosts();
      dispatch({ type: "FETCH_SUCCESS", payload: data });
    } catch (error) {
      dispatch({ type: "FETCH_ERROR", payload: error.message });
    }
  }, []);

  return { ...state, fetchPosts, dispatch };
};
```

---

## 10. TESTING STRUCTURE

```
src/
├── components/
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx
│   │   └── Button.stories.tsx  (Storybook)
│   └── ...
├── hooks/
│   ├── useFormValidation/
│   │   ├── useFormValidation.ts
│   │   └── useFormValidation.test.ts
│   └── ...
└── services/
    ├── api/
    │   ├── users.ts
    │   └── users.test.ts
    └── ...
```

### Component Testing Example

```typescript
// components/Button/Button.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders with label", () => {
    render(<Button label="Click me" onClick={() => {}} />);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("calls onClick handler when clicked", () => {
    const handleClick = jest.fn();
    render(<Button label="Click" onClick={handleClick} />);
    fireEvent.click(screen.getByText("Click"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("disables button when disabled prop is true", () => {
    render(<Button label="Click" onClick={() => {}} disabled={true} />);
    expect(screen.getByText("Click")).toBeDisabled();
  });
});
```

---

## 11. FILE NAMING CONVENTIONS

| Type           | Convention                    | Example                              |
| -------------- | ----------------------------- | ------------------------------------ |
| Components     | PascalCase                    | `UserProfile.tsx`, `PostCard.tsx`    |
| Hooks          | camelCase with `use`          | `useFormValidation.ts`, `useAuth.ts` |
| Services/Utils | camelCase                     | `userApi.ts`, `formatters.ts`        |
| Types          | camelCase                     | `user.types.ts`, `api.types.ts`      |
| Tests          | `.test.ts` or `.spec.ts`      | `Button.test.tsx`                    |
| Styles         | `.styles.ts` or `.module.css` | `Button.styles.tsx`                  |
| Folders        | kebab-case                    | `user-profile/`, `post-list/`        |
| Constants      | UPPER_SNAKE_CASE              | `MAX_RETRIES`, `API_TIMEOUT`         |

---

## 12. IMPORT/EXPORT PATTERNS

### Barrel File Pattern (index.ts)

```typescript
// components/index.ts
export { Button } from "./Button";
export { Modal } from "./Modal";
export type { ButtonProps } from "./Button";

// Usage
import { Button, Modal, type ButtonProps } from "./components";
```

### Avoid Deep Imports

```typescript
// ❌ Don't do this
import { Button } from "./components/Button/Button";

// ✅ Do this
import { Button } from "./components";
```

### Path Aliases (tsconfig.json)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@components/*": ["src/components/*"],
      "@hooks/*": ["src/hooks/*"],
      "@services/*": ["src/services/*"],
      "@types/*": ["src/types/*"],
      "@utils/*": ["src/utils/*"],
      "@features/*": ["src/features/*"]
    }
  }
}
```

Usage with aliases:

```typescript
import { Button } from "@components";
import { useFormValidation } from "@hooks";
import { userApi } from "@services/api";
import type { User } from "@types";
```

---

## 13. QUICK VERIFICATION CHECKLIST

### Before Committing Code:

- ✅ Each component has a clear, single responsibility
- ✅ All props are typed
- ✅ No `any` types used
- ✅ Custom hooks start with `use`
- ✅ API calls are in service layer, not components
- ✅ Context has custom hook wrapper (`useTheme()` not `useContext(ThemeContext)`)
- ✅ Styles are co-located with components
- ✅ No prop drilling (>2 levels) without Context or state management
- ✅ Component nesting doesn't exceed 4 levels
- ✅ Tests cover happy path and error scenarios
- ✅ No console.logs or debugger statements
- ✅ No hardcoded API URLs (use config/env)
- ✅ All dependencies in hook dependency arrays
- ✅ Components exported from barrel files
- ✅ Feature folders are independent and isolated

---

## 14. PROJECT INITIALIZATION TEMPLATE

```bash
# Create structure
mkdir -p src/{components,pages,features,hooks,context,services,utils,types,assets,config}
mkdir -p src/services/api

# Install common dependencies
npm install react react-dom
npm install -D typescript @types/react @types/react-dom
npm install styled-components axios
npm install @tanstack/react-query
npm install -D @testing-library/react @testing-library/jest-dom jest

# Create initial files
touch src/App.tsx src/index.tsx tsconfig.json .env.example
```
