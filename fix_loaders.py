import os
import re

app_dir = r"D:\BHS\WEB\app"

bad_fallback_pattern = re.compile(
    r'<Suspense\s+fallback=\{\s*(?:<div[^>]*>.*?</div>\s*)+}\s*>',
    re.DOTALL
)

single_line_fallback_pattern = re.compile(
    r'<Suspense\s+fallback=\{<div[^>]*>.*?</div>\}>',
    re.DOTALL
)

import_statement = "import MainLoader from '@/app/Components/Loading/MainLoader';\n"
fallback_replacement = "<Suspense fallback={<MainLoader />}>"

def fix_loaders():
    modified_files = 0
    for root, dirs, files in os.walk(app_dir):
        for file in files:
            if not file.endswith('.tsx'):
                continue
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            new_content = content
            
            # Check for multi-line div fallbacks that might contain spinners
            # We want to be careful not to replace legitimate loaders, but most page/layout Suspense fallbacks should be MainLoader.
            # Let's specifically look for fallback={ ... animate-spin ... } or fallback={ ... Loading... ... }
            
            # A more robust regex:
            # find <Suspense fallback={...}> where ... contains a <div> and either "animate-spin" or "Loading"
            
            def replacer(match):
                inner_content = match.group(0)
                if 'animate-spin' in inner_content or 'Loading' in inner_content:
                    return fallback_replacement
                return inner_content
            
            # Match <Suspense fallback={...}> handling potential newlines
            # We will use a regex to capture from <Suspense to the matching closing bracket }>
            # This is tricky with regex, so we'll do a simpler search.
            
            # Let's just find `fallback={<div...` and replace it if it's the bad one
            pattern = re.compile(r'<Suspense\s+fallback=\{\s*<div[^>]*>.*?(?:animate-spin|Loading).*?</div>\s*\}\s*>', re.DOTALL | re.IGNORECASE)
            
            matches = pattern.findall(new_content)
            if matches:
                new_content = pattern.sub(fallback_replacement, new_content)
                
            if new_content != content:
                # Add import if missing
                if 'MainLoader' not in new_content:
                    # insert after last import or at top
                    imports_end = [m.end() for m in re.finditer(r'^import.*$', new_content, re.MULTILINE)]
                    if imports_end:
                        insert_pos = imports_end[-1] + 1
                        new_content = new_content[:insert_pos] + import_statement + new_content[insert_pos:]
                    else:
                        new_content = import_statement + new_content
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Fixed: {filepath}")
                modified_files += 1

    print(f"Total files modified: {modified_files}")

if __name__ == '__main__':
    fix_loaders()
