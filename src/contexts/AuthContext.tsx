import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar?: string;
  content: string;
  likes: string[];
  dislikes: string[];
  replies: Comment[];
  createdAt: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar?: string;
  content: string;
  images?: string[];
  videos?: string[];
  poll?: {
    question: string;
    options: { id: string; text: string; votes: number }[];
    votedBy: string[];
  };
  location?: string;
  likes: string[];
  dislikes: string[];
  comments: Comment[];
  views: number;
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  username: string;
  profilePicture?: string;
  education: EducationItem[];
  experience: ExperienceItem[];
  posts: Post[];
  followers: string[];
  following: string[];
}

interface EducationItem {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startYear: string;
  endYear: string;
  skills: string;
  logo?: string;
}

interface ExperienceItem {
  id: string;
  company: string;
  title: string;
  type: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
  skills: string;
  logo?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => void;
  createPost: (post: Omit<Post, 'id' | 'authorId' | 'authorName' | 'authorUsername' | 'authorAvatar' | 'createdAt' | 'likes' | 'dislikes' | 'comments' | 'views'>) => void;
  toggleFollow: (userId: string) => void;
  getUserById: (userId: string) => User | null;
  getAllUsers: () => User[];
  togglePostLike: (postId: string, authorId: string) => void;
  togglePostDislike: (postId: string, authorId: string) => void;
  addComment: (postId: string, authorId: string, content: string, parentCommentId?: string) => void;
  toggleCommentLike: (postId: string, authorId: string, commentId: string) => void;
  toggleCommentDislike: (postId: string, authorId: string, commentId: string) => void;
  getPostById: (postId: string, authorId: string) => Post | null;
}

// Mock users database with demo user
const mockUsers: User[] = [
  {
    id: 'demo-user-1',
    email: 'demo@example.com',
    username: 'DemoUser',
    profilePicture: undefined,
    education: [
      {
        id: '1',
        institution: 'IIT Bombay',
        degree: 'B.Tech',
        field: 'Computer Science',
        startYear: '2020',
        endYear: '2024',
        skills: 'React, TypeScript, Node.js',
      }
    ],
    experience: [
      {
        id: '1',
        company: 'Tech Corp',
        title: 'Software Engineer',
        type: 'Full-time',
        location: 'Bangalore, India',
        startDate: '2024',
        endDate: 'Present',
        description: 'Working on building scalable web applications',
        skills: 'React, Node.js, PostgreSQL',
      }
    ],
    posts: [
      {
        id: 'demo-post-1',
        authorId: 'demo-user-1',
        authorName: 'DemoUser',
        authorUsername: 'DemoUser',
        content: 'Just finished an amazing project using React and TypeScript! The development experience has been incredible. #webdev #react',
        likes: [],
        dislikes: [],
        comments: [],
        views: 234,
        createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      },
      {
        id: 'demo-post-2',
        authorId: 'demo-user-1',
        authorName: 'DemoUser',
        authorUsername: 'DemoUser',
        content: 'Looking for advice on best practices for state management in large React applications. What do you all recommend?',
        likes: [],
        dislikes: [],
        comments: [],
        views: 567,
        createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      }
    ],
    followers: [],
    following: [],
  }
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    const storedMockUsers = localStorage.getItem('mockUsers');
    if (storedMockUsers) {
      mockUsers.push(...JSON.parse(storedMockUsers));
    }
  }, []);

  const login = async (email: string, password: string) => {
    // Simulate login
    const existingUser = mockUsers.find(u => u.email === email);
    if (existingUser) {
      setUser(existingUser);
      localStorage.setItem('user', JSON.stringify(existingUser));
    } else {
      const mockUser: User = {
        id: '1',
        email,
        username: email.split('@')[0],
        education: [],
        experience: [],
        posts: [],
        followers: [],
        following: [],
      };
      mockUsers.push(mockUser);
      setUser(mockUser);
      localStorage.setItem('user', JSON.stringify(mockUser));
      localStorage.setItem('mockUsers', JSON.stringify(mockUsers));
    }
  };

  const signup = async (email: string, password: string) => {
    // Simulate signup
    const mockUser: User = {
      id: Date.now().toString(),
      email,
      username: email.split('@')[0],
      education: [],
      experience: [],
      posts: [],
      followers: [],
      following: [],
    };
    mockUsers.push(mockUser);
    setUser(mockUser);
    localStorage.setItem('user', JSON.stringify(mockUser));
    localStorage.setItem('mockUsers', JSON.stringify(mockUsers));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const updateProfile = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      const userIndex = mockUsers.findIndex(u => u.id === user.id);
      if (userIndex !== -1) {
        mockUsers[userIndex] = updatedUser;
        localStorage.setItem('mockUsers', JSON.stringify(mockUsers));
      }
    }
  };

  const createPost = (postData: Omit<Post, 'id' | 'authorId' | 'authorName' | 'authorUsername' | 'authorAvatar' | 'createdAt' | 'likes' | 'dislikes' | 'comments' | 'views'>) => {
    if (user) {
      const newPost: Post = {
        id: Date.now().toString(),
        authorId: user.id,
        authorName: user.username,
        authorUsername: user.username,
        authorAvatar: user.profilePicture,
        createdAt: new Date().toISOString(),
        likes: [],
        dislikes: [],
        comments: [],
        views: 0,
        ...postData,
      };
      
      const updatedUser = {
        ...user,
        posts: [newPost, ...user.posts],
      };
      
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      const userIndex = mockUsers.findIndex(u => u.id === user.id);
      if (userIndex !== -1) {
        mockUsers[userIndex] = updatedUser;
        localStorage.setItem('mockUsers', JSON.stringify(mockUsers));
      }
    }
  };

  const togglePostLike = (postId: string, authorId: string) => {
    if (!user) return;

    const targetUserIndex = mockUsers.findIndex(u => u.id === authorId);
    if (targetUserIndex === -1) return;

    const targetUser = mockUsers[targetUserIndex];
    const postIndex = targetUser.posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return;

    const post = targetUser.posts[postIndex];
    const hasLiked = post.likes.includes(user.id);
    const hasDisliked = post.dislikes.includes(user.id);

    const updatedLikes = hasLiked 
      ? post.likes.filter(id => id !== user.id)
      : [...post.likes, user.id];
    
    const updatedDislikes = hasDisliked
      ? post.dislikes.filter(id => id !== user.id)
      : post.dislikes;

    targetUser.posts[postIndex] = {
      ...post,
      likes: updatedLikes,
      dislikes: updatedDislikes,
    };

    mockUsers[targetUserIndex] = targetUser;
    localStorage.setItem('mockUsers', JSON.stringify(mockUsers));

    if (user.id === authorId) {
      setUser(targetUser);
      localStorage.setItem('user', JSON.stringify(targetUser));
    }
  };

  const togglePostDislike = (postId: string, authorId: string) => {
    if (!user) return;

    const targetUserIndex = mockUsers.findIndex(u => u.id === authorId);
    if (targetUserIndex === -1) return;

    const targetUser = mockUsers[targetUserIndex];
    const postIndex = targetUser.posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return;

    const post = targetUser.posts[postIndex];
    const hasLiked = post.likes.includes(user.id);
    const hasDisliked = post.dislikes.includes(user.id);

    const updatedDislikes = hasDisliked 
      ? post.dislikes.filter(id => id !== user.id)
      : [...post.dislikes, user.id];
    
    const updatedLikes = hasLiked
      ? post.likes.filter(id => id !== user.id)
      : post.likes;

    targetUser.posts[postIndex] = {
      ...post,
      likes: updatedLikes,
      dislikes: updatedDislikes,
    };

    mockUsers[targetUserIndex] = targetUser;
    localStorage.setItem('mockUsers', JSON.stringify(mockUsers));

    if (user.id === authorId) {
      setUser(targetUser);
      localStorage.setItem('user', JSON.stringify(targetUser));
    }
  };

  const addComment = (postId: string, authorId: string, content: string, parentCommentId?: string) => {
    if (!user) return;

    const targetUserIndex = mockUsers.findIndex(u => u.id === authorId);
    if (targetUserIndex === -1) return;

    const targetUser = mockUsers[targetUserIndex];
    const postIndex = targetUser.posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      postId,
      authorId: user.id,
      authorName: user.username,
      authorUsername: user.username,
      authorAvatar: user.profilePicture,
      content,
      likes: [],
      dislikes: [],
      replies: [],
      createdAt: new Date().toISOString(),
    };

    const post = targetUser.posts[postIndex];

    if (parentCommentId) {
      const addReply = (comments: Comment[]): Comment[] => {
        return comments.map(comment => {
          if (comment.id === parentCommentId) {
            return { ...comment, replies: [...comment.replies, newComment] };
          }
          if (comment.replies.length > 0) {
            return { ...comment, replies: addReply(comment.replies) };
          }
          return comment;
        });
      };
      
      targetUser.posts[postIndex] = {
        ...post,
        comments: addReply(post.comments),
      };
    } else {
      targetUser.posts[postIndex] = {
        ...post,
        comments: [...post.comments, newComment],
      };
    }

    mockUsers[targetUserIndex] = targetUser;
    localStorage.setItem('mockUsers', JSON.stringify(mockUsers));

    if (user.id === authorId) {
      setUser(targetUser);
      localStorage.setItem('user', JSON.stringify(targetUser));
    }
  };

  const toggleCommentLike = (postId: string, authorId: string, commentId: string) => {
    if (!user) return;

    const targetUserIndex = mockUsers.findIndex(u => u.id === authorId);
    if (targetUserIndex === -1) return;

    const targetUser = mockUsers[targetUserIndex];
    const postIndex = targetUser.posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return;

    const toggleLike = (comments: Comment[]): Comment[] => {
      return comments.map(comment => {
        if (comment.id === commentId) {
          const hasLiked = comment.likes.includes(user.id);
          const hasDisliked = comment.dislikes.includes(user.id);
          
          return {
            ...comment,
            likes: hasLiked ? comment.likes.filter(id => id !== user.id) : [...comment.likes, user.id],
            dislikes: hasDisliked ? comment.dislikes.filter(id => id !== user.id) : comment.dislikes,
          };
        }
        if (comment.replies.length > 0) {
          return { ...comment, replies: toggleLike(comment.replies) };
        }
        return comment;
      });
    };

    targetUser.posts[postIndex].comments = toggleLike(targetUser.posts[postIndex].comments);
    mockUsers[targetUserIndex] = targetUser;
    localStorage.setItem('mockUsers', JSON.stringify(mockUsers));

    if (user.id === authorId) {
      setUser(targetUser);
      localStorage.setItem('user', JSON.stringify(targetUser));
    }
  };

  const toggleCommentDislike = (postId: string, authorId: string, commentId: string) => {
    if (!user) return;

    const targetUserIndex = mockUsers.findIndex(u => u.id === authorId);
    if (targetUserIndex === -1) return;

    const targetUser = mockUsers[targetUserIndex];
    const postIndex = targetUser.posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return;

    const toggleDislike = (comments: Comment[]): Comment[] => {
      return comments.map(comment => {
        if (comment.id === commentId) {
          const hasLiked = comment.likes.includes(user.id);
          const hasDisliked = comment.dislikes.includes(user.id);
          
          return {
            ...comment,
            dislikes: hasDisliked ? comment.dislikes.filter(id => id !== user.id) : [...comment.dislikes, user.id],
            likes: hasLiked ? comment.likes.filter(id => id !== user.id) : comment.likes,
          };
        }
        if (comment.replies.length > 0) {
          return { ...comment, replies: toggleDislike(comment.replies) };
        }
        return comment;
      });
    };

    targetUser.posts[postIndex].comments = toggleDislike(targetUser.posts[postIndex].comments);
    mockUsers[targetUserIndex] = targetUser;
    localStorage.setItem('mockUsers', JSON.stringify(mockUsers));

    if (user.id === authorId) {
      setUser(targetUser);
      localStorage.setItem('user', JSON.stringify(targetUser));
    }
  };

  const getPostById = (postId: string, authorId: string) => {
    const targetUser = mockUsers.find(u => u.id === authorId);
    if (!targetUser) return null;
    return targetUser.posts.find(p => p.id === postId) || null;
  };

  const toggleFollow = (userId: string) => {
    if (user && userId !== user.id) {
      const isFollowing = user.following.includes(userId);
      const updatedFollowing = isFollowing
        ? user.following.filter(id => id !== userId)
        : [...user.following, userId];
      
      const updatedUser = { ...user, following: updatedFollowing };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      const targetUserIndex = mockUsers.findIndex(u => u.id === userId);
      if (targetUserIndex !== -1) {
        const targetUser = mockUsers[targetUserIndex];
        const updatedFollowers = isFollowing
          ? targetUser.followers.filter(id => id !== user.id)
          : [...targetUser.followers, user.id];
        mockUsers[targetUserIndex] = { ...targetUser, followers: updatedFollowers };
      }
      
      const userIndex = mockUsers.findIndex(u => u.id === user.id);
      if (userIndex !== -1) {
        mockUsers[userIndex] = updatedUser;
      }
      
      localStorage.setItem('mockUsers', JSON.stringify(mockUsers));
    }
  };

  const getUserById = (userId: string) => {
    return mockUsers.find(u => u.id === userId) || null;
  };

  const getAllUsers = () => {
    return mockUsers;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        updateProfile,
        createPost,
        toggleFollow,
        getUserById,
        getAllUsers,
        togglePostLike,
        togglePostDislike,
        addComment,
        toggleCommentLike,
        toggleCommentDislike,
        getPostById,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
