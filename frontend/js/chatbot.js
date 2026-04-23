// chatbot.js - Chat assistant

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('chatbotToggle').onclick = () => document.getElementById('chatbotBox').classList.toggle('active');
    document.getElementById('closeChatbot').onclick = () => document.getElementById('chatbotBox').classList.remove('active');

    document.getElementById('sendChatbotMessage').onclick = sendMessage;
    document.getElementById('chatbotInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
});

function sendMessage() {
    const input = document.getElementById('chatbotInput');
    const msg = input.value.trim();
    if (!msg) return;
    const msgs = document.getElementById('chatbotMessages');
    msgs.innerHTML += `<div class="chat-message user-message">${msg}</div>`;
    input.value = '';
    msgs.scrollTop = msgs.scrollHeight;
    setTimeout(() => {
        const response = getSmartResponse(msg);
        msgs.innerHTML += `<div class="chat-message bot-message">${response}</div>`;
        msgs.scrollTop = msgs.scrollHeight;
    }, 300);
}

function getSmartResponse(message) {
    const msg = message.toLowerCase();
    if (msg.includes('hello') || msg.includes('hi')) return 'Hello! How can I help you with your inventory today?';
    if (msg.includes('inventory')) return `You can manage inventory from the Inventory page. Current total products: ${inventoryData.length}`;
    if (msg.includes('sale')) {
        const todayTotal = salesData.filter(s => new Date(s.date).toDateString() === new Date().toDateString()).reduce((a, b) => a + b.total, 0);
        return `Today's sales total: ${formatPrice(todayTotal)}`;
    }
    return "I'm your RetailX assistant. Ask me about inventory, sales, or suppliers!";
}