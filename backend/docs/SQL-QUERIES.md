# SQL Queries for WhatsApp Clone Database

## View All Chats

```sql
-- View all chats with user names
SELECT 
    c.id as chat_id,
    c.created_at,
    u1.id as user1_id,
    u1.name as user1_name,
    u1.email as user1_email,
    u2.id as user2_id,
    u2.name as user2_name,
    u2.email as user2_email
FROM chats c
JOIN users u1 ON c.user1_id = u1.id
JOIN users u2 ON c.user2_id = u2.id
ORDER BY c.created_at DESC;
```

## View Chats for a Specific User

```sql
-- Replace 'USER_ID_HERE' with actual user ID
SELECT 
    c.id as chat_id,
    c.created_at,
    CASE 
        WHEN c.user1_id = 'USER_ID_HERE' THEN u2.name
        ELSE u1.name
    END as other_user_name,
    CASE 
        WHEN c.user1_id = 'USER_ID_HERE' THEN u2.email
        ELSE u1.email
    END as other_user_email
FROM chats c
JOIN users u1 ON c.user1_id = u1.id
JOIN users u2 ON c.user2_id = u2.id
WHERE c.user1_id = 'USER_ID_HERE' OR c.user2_id = 'USER_ID_HERE'
ORDER BY c.created_at DESC;
```

## View Chats with Last Message

```sql
-- View chats with their last message
SELECT 
    c.id as chat_id,
    c.created_at as chat_created,
    u1.name as user1_name,
    u2.name as user2_name,
    m.content as last_message,
    m.created_at as last_message_time,
    m.status as last_message_status
FROM chats c
JOIN users u1 ON c.user1_id = u1.id
JOIN users u2 ON c.user2_id = u2.id
LEFT JOIN LATERAL (
    SELECT content, created_at, status
    FROM messages
    WHERE chat_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
) m ON true
ORDER BY m.created_at DESC NULLS LAST;
```

## View All Messages in a Chat

```sql
-- Replace 'CHAT_ID_HERE' with actual chat ID
SELECT 
    m.id as message_id,
    m.content,
    m.status,
    m.created_at,
    u.name as sender_name,
    u.email as sender_email
FROM messages m
JOIN users u ON m.sender_id = u.id
WHERE m.chat_id = 'CHAT_ID_HERE'
ORDER BY m.created_at ASC;
```

## View All Users

```sql
-- View all users
SELECT 
    id,
    email,
    name,
    created_at
FROM users
ORDER BY created_at DESC;
```

## Count Messages per Chat

```sql
-- Count messages in each chat
SELECT 
    c.id as chat_id,
    u1.name || ' & ' || u2.name as participants,
    COUNT(m.id) as message_count
FROM chats c
JOIN users u1 ON c.user1_id = u1.id
JOIN users u2 ON c.user2_id = u2.id
LEFT JOIN messages m ON m.chat_id = c.id
GROUP BY c.id, u1.name, u2.name
ORDER BY message_count DESC;
```

## View Recent Messages Across All Chats

```sql
-- View 20 most recent messages across all chats
SELECT 
    m.id as message_id,
    m.content,
    m.status,
    m.created_at,
    u1.name || ' & ' || u2.name as chat_participants,
    sender.name as sender_name
FROM messages m
JOIN chats c ON m.chat_id = c.id
JOIN users u1 ON c.user1_id = u1.id
JOIN users u2 ON c.user2_id = u2.id
JOIN users sender ON m.sender_id = sender.id
ORDER BY m.created_at DESC
LIMIT 20;
```

## Find Chats with No Messages

```sql
-- Find chats that have no messages yet
SELECT 
    c.id as chat_id,
    c.created_at,
    u1.name as user1_name,
    u2.name as user2_name
FROM chats c
JOIN users u1 ON c.user1_id = u1.id
JOIN users u2 ON c.user2_id = u2.id
LEFT JOIN messages m ON m.chat_id = c.id
WHERE m.id IS NULL;
```

## View Message Statistics

```sql
-- Message statistics
SELECT 
    COUNT(*) as total_messages,
    COUNT(DISTINCT chat_id) as total_chats_with_messages,
    COUNT(DISTINCT sender_id) as total_senders,
    COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
    COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_count,
    COUNT(CASE WHEN status = 'read' THEN 1 END) as read_count
FROM messages;
```
