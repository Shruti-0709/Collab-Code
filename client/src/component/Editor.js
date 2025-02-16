import React, { useEffect, useRef } from "react";
import "codemirror/mode/javascript/javascript";
import "codemirror/theme/dracula.css";
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";
import "codemirror/lib/codemirror.css";
import CodeMirror from "codemirror";
 
function Editor({ socketRef, roomId, onCodeChange }) {
    const editorRef = useRef(null);

    useEffect(() => {
        const init = async () => {
            const editor = CodeMirror.fromTextArea(
                document.getElementById("realTimeEditor"),
                {
                    mode: { name: "javascript", json: true },
                    theme: "dracula",
                    autoCloseTags: true,
                    autoCloseBrackets: true,
                    lineNumbers: true
                }
            );
            editor.setSize(null, '100%');
            editorRef.current = editor;
            editorRef.current.on("change", (instance, changes) => {
                const { origin } = changes;
                const code = instance.getValue();
                onCodeChange(code);
                if (origin !== 'setValue') {
                    socketRef.current.emit("code-change", { roomId, code });
                }
            });
        };
        init();
    }, []);

    // Example fetch request from frontend to the backend
useEffect(() => {
    const fetchCode = async () => {
      try {
        const response = await fetch(`http://localhost:5001/get-code/${roomId}`);
        const data = await response.json();
  
        if (data.success) {
          console.log('Code fetched:', data.code);
          // Set the code to your editor or display it
        } else {
          console.error(data.message);
        }
      } catch (error) {
        console.error('Error fetching code:', error);
      }
    };
  
    fetchCode();
  }, [roomId]);
  
    useEffect(() => {
        if (socketRef.current) {
            socketRef.current.on("code-change", ({ code }) => {
                if (code !== null) editorRef.current.setValue(code);
            });
        }
        return () => socketRef.current.off("code-change");
    }, [socketRef.current]);

    return (
        <div style={{ overflowY: "auto", height: "100%" }}>
            <textarea id="realTimeEditor"></textarea>
        </div>
    );
}

export default Editor;
