# PowerShell script to add group chat dropdown to sidebar

$file = "client\components\chat\sidebar.tsx"

# Read the file
$content = Get-Content $file -Raw

# 1. Add Users to lucide-react imports
$content = $content -replace 'import { Search, Plus, MessageSquare } from "lucide-react";', 'import { Search, Plus, MessageSquare, Users } from "lucide-react";'

# 2. Add GroupManagementModal import
$content = $content -replace 'import { FriendRequestModal } from "./friend-request-modal";', 'import { FriendRequestModal } from "./friend-request-modal";
import { GroupManagementModal } from "./group-management-modal";'

# 3. Add new state variables
$content = $content -replace '    const \[showFriendModal, setShowFriendModal\] = useState\(false\);', '    const [showFriendModal, setShowFriendModal] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);'

# 4. Replace the + button with dropdown
$oldButton = @'
                    <button
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors relative"
                        onClick={() => setShowFriendModal(true)}
                    >
                        <Plus className="w-5 h-5" />
                        {pendingRequestsCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                {pendingRequestsCount}
                            </span>
                        )}
                    </button>
'@

$newButton = @'
                    <div className="relative">
                        <button
                            className="p-2 hover:bg-gray-200 rounded-full transition-colors relative"
                            onClick={() => setShowDropdown(!showDropdown)}
                        >
                            <Plus className="w-5 h-5" />
                            {pendingRequestsCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                    {pendingRequestsCount}
                                </span>
                            )}
                        </button>

                        {/* Dropdown Menu */}
                        {showDropdown && (
                            <div className="absolute right-0 top-12 bg-white shadow-lg rounded-lg border w-56 z-50">
                                <button
                                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b"
                                    onClick={() => {
                                        setShowFriendModal(true);
                                        setShowDropdown(false);
                                    }}
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Manage Friends</span>
                                </button>
                                <button
                                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3"
                                    onClick={() => {
                                        setShowGroupModal(true);
                                        setShowDropdown(false);
                                    }}
                                >
                                    <Users className="w-4 h-4" />
                                    <span>Create/Manage Groups</span>
                                </button>
                            </div>
                        )}
                    </div>
'@

$content = $content -replace [regex]::Escape($oldButton), $newButton

# 5. Add GroupManagementModal before closing div
$content = $content -replace '            </div>\r\n        </div>\r\n    \);\r\n}', @'
            </div>

            {/* Group Management Modal */}
            <GroupManagementModal
                isOpen={showGroupModal}
                onClose={() => {
                    setShowGroupModal(false);
                    fetchConversations(); // Refresh to show new groups
                }}
            />
        </div>
    );
}
'@

# Write the file back
$content | Set-Content $file -NoNewline

Write-Host "✅ Sidebar updated successfully!"
Write-Host "Group chat dropdown menu has been added."
