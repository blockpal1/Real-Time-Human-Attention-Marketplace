#!/bin/bash
# OpenAI Bouncer Prompt Test
# Tests the AI bouncer with various inputs

OPENAI_KEY="${OPENAI_Bouncer_Key}"
API_URL="https://api.openai.com/v1/chat/completions"

SYSTEM_PROMPT='You are a strict Data Quality AI. Output exactly one word: "PASS" or "FAIL".

You cannot see the image or media. Judge ONLY based on whether the text answer creates a logical linguistic pair with the question.

FAIL: random keystrokes, one-word generic answers, irrelevant text, bot patterns
PASS: relevant attempts, concise if accurate, minor typos ok

--- EXAMPLES ---
Q: "Describe the lighting." A: "Bright and natural." → PASS
Q: "Is there a cat?" A: "yes" → PASS
Q: "Transcribe the sign." A: "hjklasdf" → FAIL
Q: "Explain illegal parking." A: "good" → FAIL'

test_prompt() {
    local question="$1"
    local answer="$2"
    local expected="$3"
    
    echo "Testing: Q: \"$question\" A: \"$answer\""
    
    response=$(curl -s "$API_URL" \
        -H "Authorization: Bearer $OPENAI_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"model\": \"gpt-4o-mini\",
            \"messages\": [
                {\"role\": \"system\", \"content\": $(echo "$SYSTEM_PROMPT" | jq -Rs .)},
                {\"role\": \"user\", \"content\": \"Q: \\\"$question\\\"\\nA: \\\"$answer\\\"\"}
            ],
            \"temperature\": 0,
            \"max_tokens\": 5
        }")
    
    verdict=$(echo "$response" | jq -r '.choices[0].message.content' | tr '[:lower:]' '[:upper:]')
    
    if [[ "$verdict" == *"$expected"* ]]; then
        echo "✓ PASS - Got: $verdict (expected $expected)"
    else
        echo "✗ FAIL - Got: $verdict (expected $expected)"
    fi
    echo ""
}

echo "=== OpenAI Bouncer Prompt Tests ==="
echo ""

# Should PASS
test_prompt "Is there a cat?" "yes" "PASS"
test_prompt "Describe the lighting" "Bright and natural" "PASS"
test_prompt "What color is the car?" "Red" "PASS"
test_prompt "What brand is the shoe?" "Nike" "PASS"

# Should FAIL
test_prompt "Describe the image" "asdf" "FAIL"
test_prompt "Transcribe the sign" "hjklasdf" "FAIL"
test_prompt "Explain why the car is parked illegally" "good" "FAIL"
test_prompt "What is in the photo?" "idk" "FAIL"

echo "=== Tests Complete ==="
