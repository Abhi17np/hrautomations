"""
gridfs_storage.py — Helper to store and retrieve generated DOCX/PDF files in GridFS.
Place at: backend/services/gridfs_storage.py
"""
import gridfs
from io import BytesIO
from bson import ObjectId
from flask import current_app, send_file


def get_fs(collection='files_fs'):
    return gridfs.GridFS(current_app.db, collection=collection)


def save_file_to_gridfs(filepath, filename, collection='files_fs'):
    """Read a file from disk and store in GridFS. Returns gridfs_id string."""
    fs = get_fs(collection)
    with open(filepath, 'rb') as f:
        data = f.read()
    gridfs_id = fs.put(data, filename=filename)
    return str(gridfs_id)


def serve_from_gridfs(gridfs_id, download_name, mimetype='application/octet-stream',
                      as_attachment=True, collection='files_fs'):
    """Stream a file from GridFS as a Flask response."""
    fs = get_fs(collection)
    grid_out = fs.get(ObjectId(gridfs_id))
    return send_file(
        BytesIO(grid_out.read()),
        download_name=download_name,
        mimetype=mimetype,
        as_attachment=as_attachment,
    )


def delete_from_gridfs(gridfs_id, collection='files_fs'):
    """Delete a file from GridFS by its id string."""
    if not gridfs_id:
        return
    try:
        fs = get_fs(collection)
        fs.delete(ObjectId(gridfs_id))
    except Exception:
        pass