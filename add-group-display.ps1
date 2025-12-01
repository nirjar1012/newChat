# PowerShell script to add group display to sidebar

$file = "client\components\chat\sidebar.tsx"

# Read the file
$content = Get-Content $file -Raw

# Update the getUnifiedList function to include groups
$oldGetUnifiedList = @'
        // 2. Overlay conversations
        conversations.forEach(conv => {
            const otherUser = conv.other_user;
            if (otherUser && unifiedMap.has(otherUser.clerk_id)) {
                unifiedMap.set(otherUser.clerk_id, {
                    ...unifiedMap.get(otherUser.clerk_id),
                    conversation: conv,
                    last_message: conv.last_message,
                    unreadCount: unreadCounts[conv.id] || 0
                });
            }
        });
'@

$newGetUnifiedList = @'
        // 2. Overlay conversations (both individual and groups)
        conversations.forEach(conv => {
            if (conv.is_group) {
                // Group conversation - add as separate item
                unifiedMap.set(`group_${conv.id}`, {
                    user: null,
                    conversation: conv,
                    last_message: conv.last_message,
                    isOnline: false,
                    unreadCount: unreadCounts[conv.id] || 0,
                    isGroup: true,
                    groupName: conv.group_name,
                    memberCount: conv.conversation_members?.length || 0
                });
            } else {
                // Individual conversation
                const otherUser = conv.other_user;
                if (otherUser && unifiedMap.has(otherUser.clerk_id)) {
                    unifiedMap.set(otherUser.clerk_id, {
                        ...unifiedMap.get(otherUser.clerk_id),
                        conversation: conv,
                        last_message: conv.last_message,
                        unreadCount: unreadCounts[conv.id] || 0
                    });
                }
            }
        });
'@

$content = $content -replace [regex]::Escape($oldGetUnifiedList), $newGetUnifiedList

# Update the list rendering to handle groups
$oldListItem = @'
                {filteredList.map((item: any) => {
                    const u = item.user;
                    const conv = item.conversation;
                    const isActive = conv && selectedConversationId === conv.id;

                    return (
                        <div
                            key={u.clerk_id}
'@

$newListItem = @'
                {filteredList.map((item: any) => {
                    const u = item.user;
                    const conv = item.conversation;
                    const isActive = conv && selectedConversationId === conv.id;
                    const isGroup = item.isGroup;

                    return (
                        <div
                            key={isGroup ? `group_${conv.id}` : u.clerk_id}
'@

$content = $content -replace [regex]::Escape($oldListItem), $newListItem

# Update onClick handler for groups
$oldOnClick = @'
                            onClick={() => startConversation(u.clerk_id)}
'@

$newOnClick = @'
                            onClick={() => isGroup ? onSelectConversation(conv.id) : startConversation(u.clerk_id)}
'@

$content = $content -replace [regex]::Escape($oldOnClick), $newOnClick

# Update avatar rendering for groups
$oldAvatar = @'
                            <div className="relative shrink-0">
                                <div className="w-[49px] h-[49px] bg-gray-200 rounded-full overflow-hidden flex items-center justify-center">
                                    {u.profile_image ? (
                                        <img src={u.profile_image} alt={u.first_name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-[#dfe3e5] text-[#54656f] font-medium text-lg">
                                            {u.first_name?.[0] || u.username?.[0] || 'U'}{u.last_name?.[0] || ''}
                                        </div>
                                    )}
                                </div>
                                {item.isOnline && (
                                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#25d366] rounded-full border-2 border-white"></div>
                                )}
                            </div>
'@

$newAvatar = @'
                            <div className="relative shrink-0">
                                <div className="w-[49px] h-[49px] bg-gray-200 rounded-full overflow-hidden flex items-center justify-center">
                                    {isGroup ? (
                                        <div className="w-full h-full flex items-center justify-center bg-[#25d366] text-white font-bold text-lg">
                                            <Users className="w-6 h-6" />
                                        </div>
                                    ) : u.profile_image ? (
                                        <img src={u.profile_image} alt={u.first_name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-[#dfe3e5] text-[#54656f] font-medium text-lg">
                                            {u.first_name?.[0] || u.username?.[0] || 'U'}{u.last_name?.[0] || ''}
                                        </div>
                                    )}
                                </div>
                                {!isGroup && item.isOnline && (
                                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#25d366] rounded-full border-2 border-white"></div>
                                )}
                            </div>
'@

$content = $content -replace [regex]::Escape($oldAvatar), $newAvatar

# Update name display for groups
$oldName = @'
                                    <div className="font-semibold text-black text-[17px] truncate">
                                        {u.first_name || u.last_name
                                            ? `${u.first_name || ''} ${u.last_name || ''}`.trim()
                                            : u.username || 'User'
                                        }
                                    </div>
'@

$newName = @'
                                    <div className="font-semibold text-black text-[17px] truncate">
                                        {isGroup 
                                            ? item.groupName
                                            : (u.first_name || u.last_name
                                                ? `${u.first_name || ''} ${u.last_name || ''}`.trim()
                                                : u.username || 'User')
                                        }
                                    </div>
'@

$content = $content -replace [regex]::Escape($oldName), $newName

# Write the file back
$content | Set-Content $file -NoNewline

Write-Host "✅ Group display added to sidebar!"
Write-Host "Groups will now appear in the conversation list."
