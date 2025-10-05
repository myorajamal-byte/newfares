// Simple image upload API endpoint
// This would typically be implemented on your server

const fs = require('fs');
const path = require('path');
const formidable = require('formidable');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = new formidable.IncomingForm();
    const uploadDir = path.join(process.cwd(), 'public', 'image');
    
    // Create upload directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    form.uploadDir = uploadDir;
    form.keepExtensions = true;

    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error('Upload error:', err);
        return res.status(500).json({ error: 'Upload failed' });
      }

      const file = files.image;
      const fileName = fields.fileName;
      
      if (!file || !fileName) {
        return res.status(400).json({ error: 'Missing file or filename' });
      }

      const newPath = path.join(uploadDir, fileName);
      
      // Move file to final location
      fs.rename(file.filepath, newPath, (renameErr) => {
        if (renameErr) {
          console.error('File move error:', renameErr);
          return res.status(500).json({ error: 'Failed to save file' });
        }

        res.status(200).json({ 
          success: true, 
          fileName: fileName,
          path: `/image/${fileName}`
        });
      });
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}