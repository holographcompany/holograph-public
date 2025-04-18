#!/bin/bash

# Define the output filename
OUTPUT_FILE="Project_Directory_Structure.txt"

# Check if 'tree' is installed
if command -v tree &> /dev/null; then
    echo "✅ Using 'tree' to generate project structure..."
    tree -I 'node_modules|.git|.next|.vscode' -f > "$OUTPUT_FILE"
else
    echo "⚠️ 'tree' command not found! Using 'find' instead..."

    # Generate directory structure using 'find' (alternative for macOS)
    find . -type d \( -name "node_modules" -o -name ".git" -o -name ".next" -o -name ".vscode" \) -prune -false -o -print | sed 's|[^/]*/|  |g' > "$OUTPUT_FILE"
fi

echo "✅ Project structure saved to $OUTPUT_FILE"
