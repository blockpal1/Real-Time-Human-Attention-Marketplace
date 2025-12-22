#!/bin/bash
# Redis State Verification Script
# Checks Signal Quality scores in Redis

REDIS_HOST="localhost"
REDIS_PORT="6379"

echo "=== Redis Signal Quality Verification ==="
echo ""

# Function to check user quality
check_user() {
    local wallet="$1"
    echo "User: $wallet"
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" HGETALL "user:$wallet" | \
        awk 'NR%2{printf "  %s: ", $0; next} {print $0}'
    echo ""
}

# Function to list all users with quality scores
list_all_users() {
    echo "All users with quality scores:"
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" KEYS "user:*" | while read key; do
        quality=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" HGET "$key" quality)
        if [ -n "$quality" ]; then
            wallet=$(echo "$key" | sed 's/user://')
            echo "  $wallet: $quality"
        fi
    done
    echo ""
}

# Function to simulate quality changes
simulate_spam() {
    local wallet="$1"
    echo "Simulating spam for $wallet..."
    
    # Get current quality
    current=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" HGET "user:$wallet" quality)
    current=${current:-50}
    
    echo "  Current quality: $current"
    
    # Simulate 4 spam submissions
    for i in {1..4}; do
        new_quality=$((current - 10))
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" HSET "user:$wallet" quality "$new_quality" > /dev/null
        echo "  After spam $i: $new_quality"
        current=$new_quality
        
        if [ "$new_quality" -lt 20 ]; then
            echo "  🚫 BANNED (quality < 20)"
            break
        fi
    done
    echo ""
}

# Main menu
case "$1" in
    check)
        if [ -z "$2" ]; then
            echo "Usage: $0 check <wallet>"
            exit 1
        fi
        check_user "$2"
        ;;
    list)
        list_all_users
        ;;
    simulate)
        if [ -z "$2" ]; then
            echo "Usage: $0 simulate <wallet>"
            exit 1
        fi
        simulate_spam "$2"
        ;;
    reset)
        if [ -z "$2" ]; then
            echo "Usage: $0 reset <wallet>"
            exit 1
        fi
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" DEL "user:$2"
        echo "✓ Deleted user:$2"
        ;;
    *)
        echo "Usage:"
        echo "  $0 check <wallet>     - Check user quality"
        echo "  $0 list               - List all users"
        echo "  $0 simulate <wallet>  - Simulate spam attacks"
        echo "  $0 reset <wallet>     - Reset user data"
        ;;
esac
