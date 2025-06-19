// Global variables
const API_BASE_URL = 'https://neocities-api.vercel.app';
let currentPath = '';
let currentFiles = [];
let authData = null;

// Add event listener for toggle button
document.querySelector('.toggleBtn').addEventListener('click', toggleDarkMode);

// Initialize the application
document.addEventListener('DOMContentLoaded', function () {
	checkDarkModePreference();
	checkAuthStatus();
	setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
	// Auth forms
	document.getElementById('authForm').addEventListener('submit', handleAuth);
	document.getElementById('apiKeyForm').addEventListener('submit', handleApiKeyAuth);

	// File operations
	document.getElementById('uploadForm').addEventListener('submit', handleUpload);
	document.getElementById('createForm').addEventListener('submit', handleCreateFile);
	document.getElementById('editForm').addEventListener('submit', handleEditFile);

	// Modal close on outside click
	document.querySelectorAll('.modal').forEach(modal => {
		modal.addEventListener('click', function (e) {
			if (e.target === modal) {
				closeModal(modal.id);
			}
		});
	});
}

// Check authentication status
async function checkAuthStatus() {
	try {
		const response = await fetch(`${API_BASE_URL}/api/auth`);
		const data = await response.json();

		if (data.result === 'error') {
			showMessage(data.message, 'error');
		} else if (data.hasUsername || data.hasApiKey) {
			showMessage(`Welcome ${data.username}`, 'info');
		}

		if (data.hasUsername || data.hasApiKey) {
			authData = data;
			document.getElementById('authSection').style.display = 'none';
			document.getElementById('dashboard').style.display = 'block';
			document.getElementById('userInfo').style.display = 'flex';
			document.getElementById('usernameDisplay').textContent = data.username || 'User';

			await loadSiteInfo();
			await loadFiles();
		} else {
			showAuthSection();
		}
	} catch (error) {
		console.error('Auth check failed:', error);
		showAuthSection();
	}
}

// Show authentication section
function showAuthSection() {
	document.getElementById('authSection').style.display = 'block';
	document.getElementById('dashboard').style.display = 'none';
	document.getElementById('userInfo').style.display = 'none';
}

// Handle username/password authentication
async function handleAuth(e) {
	e.preventDefault();

	const username = document.getElementById('loginUsername').value;
	const password = document.getElementById('loginPassword').value;

	if (!username || !password) {
		showMessage('Please enter both username and password', 'error');
		return;
	}

	try {
		const response = await fetch(`${API_BASE_URL}/api/auth`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ username, password })
		});

		const data = await response.json();

		if (data.success) {
			showMessage('Authentication successful!', 'success');
			await checkAuthStatus();
		} else {
			showMessage(data.message || 'Authentication failed', 'error');
		}
	} catch (error) {
		console.error('Auth error:', error);
		showMessage('Authentication failed', 'error');
	}
}

// Handle API key authentication
async function handleApiKeyAuth(e) {
	e.preventDefault();

	const apiKey = document.getElementById('apiKey').value;

	if (!apiKey) {
		showMessage('Please enter your API key', 'error');
		return;
	}

	try {
		const response = await fetch(`${API_BASE_URL}/api/auth`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ apiKey })
		});

		const data = await response.json();

		if (data.success) {
			showMessage('API key authentication successful!', 'success');
			await checkAuthStatus();
		} else {
			showMessage(data.message || 'API key authentication failed', 'error');
		}
	} catch (error) {
		console.error('API key auth error:', error);
		showMessage('API key authentication failed', 'error');
	}
}

// Logout
async function logout() {
	try {
		await fetch(`${API_BASE_URL}/api/auth`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ username: '', password: '', apiKey: '' })
		});

		authData = null;
		currentPath = '';
		currentFiles = [];

		showAuthSection();
		showMessage('Logged out successfully', 'info');
	} catch (error) {
		console.error('Logout error:', error);
		showMessage('Logout failed', 'error');
	}
}

// Load site information
async function loadSiteInfo() {
	try {
		const response = await fetch(`${API_BASE_URL}/api/info`);
		const data = await response.json();

		if (data.result === 'success') {
			const info = data.info;
			document.getElementById('hits').textContent = info.hits.toLocaleString();
			document.getElementById('created').textContent = formatDate(info.created_at);
			document.getElementById('lastUpdated').textContent = formatDate(info.last_updated);
			document.getElementById('domain').textContent = info.domain || info.sitename + '.neocities.org';
		}
	} catch (error) {
		console.error('Failed to load site info:', error);
		showMessage('Failed to load site information', 'error');
	}
}

// Load files for current path
async function loadFiles() {
	document.getElementById('loading').style.display = 'block';

	try {
		const url = currentPath ?
			`${API_BASE_URL}/api/list?path=${encodeURIComponent(currentPath)}` :
			`${API_BASE_URL}/api/list`;
		const response = await fetch(url);
		const data = await response.json();

		if (data.result === 'success') {
			currentFiles = data.files || [];
			renderFiles();
			updateBreadcrumb();
		} else {
			showMessage('Failed to load files: ' + data.message, 'error');
		}
	} catch (error) {
		console.error('Failed to load files:', error);
		showMessage('Failed to load files', 'error');
	} finally {
		document.getElementById('loading').style.display = 'none';
	}
}

// Render files in the file list
function renderFiles() {
	const fileList = document.getElementById('fileList');
	const loading = document.getElementById('loading');

	// Clear existing files except loading
	fileList.innerHTML = '';
	fileList.appendChild(loading);

	if (currentFiles.length === 0) {
		const emptyMessage = document.createElement('div');
		emptyMessage.className = 'file-item';
		emptyMessage.innerHTML = '<p style="text-align: center; color: var(--gray); width: 100%;">No files found in this directory</p>';
		fileList.appendChild(emptyMessage);
		return;
	}

	// Sort files: directories first, then by name
	const sortedFiles = currentFiles.sort((a, b) => {
		if (a.is_directory && !b.is_directory) return -1;
		if (!a.is_directory && b.is_directory) return 1;
		return a.path.localeCompare(b.path);
	});

	sortedFiles.forEach(file => {
		const fileItem = createFileItem(file);
		fileList.appendChild(fileItem);
	});
}

// Create a file item element
function createFileItem(file) {
	const item = document.createElement('div');
	item.className = 'file-item';

	const fileName = file.path.split('/').pop();
	const fileType = getFileType(fileName);
	const fileSize = file.is_directory ? '-' : formatBytes(file.size);
	const updatedAt = formatDate(file.updated_at);

	item.innerHTML = `
    <div class="file-icon ${file.is_directory ? 'folder' : ''} ${fileType}">
      <i class="fas fa-${file.is_directory ? 'folder' : getFileIcon(fileName)}"></i>
    </div>
    <div class="file-info">
      <div class="file-name">${fileName}</div>
      <div class="file-meta">
        <span>${fileSize}</span>
        <span>${updatedAt}</span>
      </div>
    </div>
    <div class="file-actions">
      ${file.is_directory ?
			`<button class="file-action" onclick="navigateTo('${file.path}')">
          <i class="fas fa-folder-open"></i> Open
        </button>` :
			`<button class="file-action" onclick="editFile('${file.path}')">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="file-action" onclick="downloadFile('${file.path}')">
          <i class="fas fa-download"></i> View
        </button>`
		}
      ${fileName !== 'index.html' ?
			`<button class="file-action danger" onclick="confirmDelete('${file.path}')">
          <i class="fas fa-trash"></i> Delete
        </button>` : ''
		}
    </div>
  `;

	return item;
}

// Navigate to a directory
function navigateTo(path) {
	currentPath = path;
	loadFiles();
}

// Update breadcrumb navigation
function updateBreadcrumb() {
	const breadcrumb = document.getElementById('breadcrumb');
	breadcrumb.innerHTML = '';

	// Home link
	const homeLink = document.createElement('span');
	homeLink.textContent = 'Home';
	homeLink.onclick = () => navigateTo('');
	breadcrumb.appendChild(homeLink);

	// Path segments
	if (currentPath) {
		const segments = currentPath.split('/');
		let buildPath = '';

		segments.forEach((segment, index) => {
			if (!segment) return;
			buildPath += (index > 0 ? '/' : '') + segment;
			const link = document.createElement('span');
			link.textContent = segment;
			link.onclick = () => navigateTo(buildPath);
			breadcrumb.appendChild(link);
		});
	}
}

// Refresh files
async function refreshFiles() {
	loadFiles();
	await loadSiteInfo();
	showMessage('Files and stats refreshed', 'info');
}

// Show upload modal
function showUploadModal() {
	document.getElementById('uploadPath').value = currentPath;
	showModal('uploadModal');
}

// Show create file modal
function showCreateModal() {
	document.getElementById('createPath').value = currentPath;
	document.getElementById('createFileName').value = '';
	document.getElementById('createContent').value = '';
	showModal('createModal');
}

// Handle file upload
async function handleUpload(e) {
	e.preventDefault();

	const fileInput = document.getElementById('fileInput');
	const uploadPath = document.getElementById('uploadPath').value;

	if (!fileInput.files.length) {
		showMessage('Please select files to upload', 'error');
		return;
	}

	const formData = new FormData();

	for (let file of fileInput.files) {
		formData.append('files', file);
	}

	if (uploadPath) {
		formData.append('path', uploadPath);
	}

	try {
		const response = await fetch(`${API_BASE_URL}/api/upload`, {
			method: 'POST',
			body: formData
		});

		const data = await response.json();

		if (data.result === 'success') {
			showMessage('Files uploaded successfully!', 'success');
			closeModal('uploadModal');
			fileInput.value = '';
			await loadFiles();
		} else {
			showMessage('Upload failed: ' + data.message, 'error');
		}
	} catch (error) {
		console.error('Upload error:', error);
		showMessage('Upload failed', 'error');
	}
}

// Handle create file
async function handleCreateFile(e) {
	e.preventDefault();

	const fileName = document.getElementById('createFileName').value;
	const content = document.getElementById('createContent').value;
	const path = document.getElementById('createPath').value;

	if (!fileName) {
		showMessage('Please enter a file name', 'error');
		return;
	}

	try {
		const response = await fetch(`${API_BASE_URL}/api/create-file`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				filename: fileName,
				content: content,
				path: path
			})
		});

		const data = await response.json();

		if (data.result === 'success') {
			showMessage('File created successfully!', 'success');
			closeModal('createModal');
			await loadFiles();
		} else {
			showMessage('File creation failed: ' + data.message, 'error');
		}
	} catch (error) {
		console.error('Create file error:', error);
		showMessage('File creation failed', 'error');
	}
}

// Edit file
async function editFile(filePath) {
	document.getElementById('editFileName').textContent = filePath;
	document.getElementById('editContent').value = 'Loading...';
	showModal('editModal');

	try {
		const response = await fetch(`${API_BASE_URL}/api/download/${encodeURIComponent(filePath)}`);
		const data = await response.json();

		if (data.result === 'success') {
			document.getElementById('editContent').value = data.content;
		} else {
			showMessage('Failed to load file content: ' + data.message, 'error');
			document.getElementById('editContent').value = 'Failed to load file content';
		}
	} catch (error) {
		console.error('Edit file error:', error);
		showMessage('Failed to load file content', 'error');
		document.getElementById('editContent').value = 'Failed to load file content';
	}
}

// Handle edit file
async function handleEditFile(e) {
	e.preventDefault();

	const fileName = document.getElementById('editFileName').textContent;
	const content = document.getElementById('editContent').value;

	// Get the submit button
	const submitButton = document.querySelector('#editForm button[type="submit"]');
	const originalButtonText = submitButton.innerHTML;

	// Show saving state
	submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
	submitButton.disabled = true;

	try {
		const formData = new FormData();
		const blob = new Blob([content], { type: 'text/plain' });
		formData.append('files', blob, fileName);

		const response = await fetch(`${API_BASE_URL}/api/upload`, {
			method: 'POST',
			body: formData
		});

		const data = await response.json();

		if (data.result === 'success') {
			showMessage('File saved successfully!', 'success');
			closeModal('editModal');
			await loadFiles();
		} else {
			showMessage('File save failed: ' + data.message, 'error');
		}
	} catch (error) {
		console.error('Save file error:', error);
		showMessage('File save failed', 'error');
	} finally {
		// Restore original button state
		submitButton.innerHTML = originalButtonText;
		submitButton.disabled = false;
	}
}

// Download/view file
async function downloadFile(filePath) {
	try {
		const response = await fetch(`${API_BASE_URL}/api/download/${encodeURIComponent(filePath)}`);
		const data = await response.json();

		if (data.result === 'success') {
			// Create a new window to display the content
			const newWindow = window.open('', '_blank');
			newWindow.document.write(`
        <html>
          <head>
            <title>${filePath}</title>
            <style>
              body { font-family: monospace; margin: 20px; }
              pre { white-space: pre-wrap; word-wrap: break-word; }
            </style>
          </head>
          <body>
            <h3>File: ${filePath}</h3>
            <pre>${data.content}</pre>
          </body>
        </html>
      `);
			newWindow.document.close();
		} else {
			showMessage('Failed to download file: ' + data.message, 'error');
		}
	} catch (error) {
		console.error('Download file error:', error);
		showMessage('Failed to download file', 'error');
	}
}

// Confirm delete
function confirmDelete(filePath) {
	document.getElementById('confirmMessage').textContent = `Are you sure you want to delete "${filePath}"? This action cannot be undone.`;
	document.getElementById('confirmYes').onclick = () => deleteFile(filePath);
	showModal('confirmModal');
}

// Delete file
async function deleteFile(filePath) {
	try {
		const response = await fetch(`${API_BASE_URL}/api/delete`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				filenames: [filePath]
			})
		});

		const data = await response.json();

		if (data.result === 'success') {
			showMessage('File deleted successfully!', 'success');
			closeModal('confirmModal');
			await loadFiles();
		} else {
			showMessage('Delete failed: ' + data.message, 'error');
		}
	} catch (error) {
		console.error('Delete error:', error);
		showMessage('Delete failed', 'error');
	}
}

// Modal functions
function showModal(modalId) {
	document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
	document.getElementById(modalId).classList.remove('active');
}

// Show status message
function showMessage(message, type = 'info') {
	const container = document.getElementById('statusMessages');
	const messageEl = document.createElement('div');
	messageEl.className = `status-message ${type}`;

	const icon = type === 'success' ? 'check-circle' :
		type === 'error' ? 'exclamation-circle' :
			'info-circle';

	messageEl.innerHTML = `
    <i class="fas fa-${icon}"></i>
    <span>${message}</span>
  `;

	container.appendChild(messageEl);

	// Auto remove after 5 seconds
	setTimeout(() => {
		if (messageEl.parentNode) {
			messageEl.parentNode.removeChild(messageEl);
		}
	}, 5000);
}

// Utility functions
function formatBytes(bytes) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
	const date = new Date(dateString);
	return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getFileType(fileName) {
	const ext = fileName.split('.').pop().toLowerCase();
	switch (ext) {
		case 'html':
		case 'htm':
			return 'html';
		case 'css':
			return 'css';
		case 'js':
			return 'js';
		case 'json':
			return 'json';
		case 'md':
			return 'md';
		case 'txt':
			return 'txt';
		case 'png':
		case 'jpg':
		case 'jpeg':
		case 'gif':
		case 'svg':
		case 'webp':
			return 'image';
		default:
			return '';
	}
}

function getFileIcon(fileName) {
	const ext = fileName.split('.').pop().toLowerCase();
	switch (ext) {
		case 'html':
		case 'htm':
			return 'code';
		case 'css':
			return 'palette';
		case 'js':
			return 'cogs';
		case 'json':
			return 'brackets-curly';
		case 'md':
			return 'markdown';
		case 'txt':
			return 'file-alt';
		case 'png':
		case 'jpg':
		case 'jpeg':
		case 'gif':
		case 'svg':
		case 'webp':
			return 'image';
		case 'pdf':
			return 'file-pdf';
		case 'zip':
		case 'rar':
		case '7z':
			return 'file-archive';
		default:
			return 'file';
	}
}

// Dark mode toggle
function toggleDarkMode() {
	document.body.classList.toggle('dark-mode');
	localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

// Check for saved dark mode preference
function checkDarkModePreference() {
	const darkMode = localStorage.getItem('darkMode') === 'true';
	if (darkMode) {
		document.body.classList.add('dark-mode');
	}
}