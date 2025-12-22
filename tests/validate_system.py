"""
Signal Quality System Validation
Quick checks to verify the system is properly configured
"""
import sys

def check_redis():
    """Check Redis connection"""
    try:
        import redis
        r = redis.Redis(host='localhost', port=6379, decode_responses=True)
        r.ping()
        print("✓ Redis: Connected")
        return True
    except ImportError:
        print("✗ Redis: Module not installed (run: python -m pip install redis)")
        return False
    except Exception as e:
        print(f"✗ Redis: Connection failed - {e}")
        return False

def check_openai_key():
    """Check if OpenAI key is set"""
    import os
    key = os.getenv('OPENAI_Bouncer_Key')
    if key and key.startswith('sk-'):
        print("✓ OpenAI: Bouncer key configured")
        return True
    else:
        print("✗ OpenAI: OPENAI_Bouncer_Key not set in environment")
        return False

def check_backend():
    """Check if backend is running"""
    try:
        import requests
        response = requests.get('http://localhost:3000/v1/status', timeout=2)
        if response.status_code == 200:
            print("✓ Backend: Running on port 3000")
            return True
        else:
            print(f"✗ Backend: Unexpected status {response.status_code}")
            return False
    except ImportError:
        print("✗ Requests: Module not installed (run: python -m pip install requests)")
        return False
    except Exception as e:
        print(f"✗ Backend: Not reachable - {e}")
        return False

def check_typescript():
    """Check if TypeScript compiles"""
    import subprocess
    try:
        result = subprocess.run(
            ['npx', 'tsc', '--noEmit'],
            cwd='backend',
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            print("✓ TypeScript: Compiles with no errors")
            return True
        else:
            print("✗ TypeScript: Compilation errors")
            print(result.stdout[:200])
            return False
    except Exception as e:
        print(f"⚠ TypeScript: Could not check - {e}")
        return None

def check_files():
    """Check if key files exist"""
    import os
    files = [
        'backend/src/lib/prompts.ts',
        'backend/src/services/TrustService.ts',
        'backend/src/controllers/MatchController.ts',
        'frontend/src/components/MatchNotificationModal.tsx'
    ]
    
    all_exist = True
    for file in files:
        if os.path.exists(file):
            print(f"✓ File: {file}")
        else:
            print(f"✗ File: {file} not found")
            all_exist = False
    
    return all_exist

def main():
    print("=== Signal Quality System Validation ===\n")
    
    results = {
        'Files': check_files(),
        'Redis': check_redis(),
        'Backend': check_backend(),
        'OpenAI Key': check_openai_key(),
    }
    
    print("\n" + "="*40)
    
    passed = sum(1 for v in results.values() if v is True)
    total = len(results)
    
    if passed == total:
        print(f"✅ All checks passed ({passed}/{total})")
        print("\nSystem is ready for testing!")
        print("Next step: Follow tests/MANUAL_TESTING.md")
        return 0
    else:
        print(f"⚠️  {passed}/{total} checks passed")
        print("\nFix the issues above before testing.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
