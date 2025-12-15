import React from 'react';
import Editor, { OnMount } from '@monaco-editor/react';

interface SqlEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  height?: string;
  className?: string;
  readOnly?: boolean;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({ 
  value, 
  onChange, 
  height = "300px", 
  className,
  readOnly = false
}) => {
  
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    // Здесь можно настроить редактор после монтирования
    // например, добавить горячие клавиши или кастомные темы
  };

  return (
    <div className={`border border-gray-700 rounded-md overflow-hidden ${className}`}>
      <Editor
        height={height}
        defaultLanguage="sql"
        value={value}
        onChange={onChange}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          readOnly: readOnly,
          padding: { top: 10, bottom: 10 },
        }}
        onMount={handleEditorDidMount}
      />
    </div>
  );
};

