/**
 * 图片渲染器
 *
 * 负责渲染各种类型的图片：
 * - Data URI (base64)
 * - HTTP/HTTPS URL
 * - file:// URI
 */

import type { App } from 'obsidian';
import { setIcon, Modal, TFile } from 'obsidian';

/**
 * 图片渲染器
 */
export class ImageRenderer {
	/**
	 * 渲染图片（支持 data URI, HTTP/HTTPS URI, file:// URI）
	 */
	public static render(container: HTMLElement, uri: string, app: App): void {
		const imageWrapper = container.createDiv({ cls: 'acp-content-image-wrapper' });
		const imgEl = imageWrapper.createEl('img', { cls: 'acp-content-image' });
		imgEl.alt = '图像';

		// 处理不同类型的 URI
		if (uri.startsWith('data:')) {
			imgEl.src = uri;
			this.setupImageEvents(imgEl, imageWrapper, app);
		} else if (uri.startsWith('http://') || uri.startsWith('https://')) {
			imgEl.src = uri;
			this.setupImageEvents(imgEl, imageWrapper, app);
		} else if (uri.startsWith('file://')) {
			void this.handleFileUri(uri, imgEl, imageWrapper, app);
		} else {
			imgEl.src = uri;
			this.setupImageEvents(imgEl, imageWrapper, app);
		}
	}

	/**
	 * 处理 file:// URI
	 */
	private static async handleFileUri(
		uri: string,
		imgEl: HTMLImageElement,
		imageWrapper: HTMLElement,
		app: App,
	): Promise<void> {
		try {
			let filePath = uri;

			// 移除 file:// 前缀
			if (filePath.startsWith('file:///')) {
				filePath = filePath.substring(7);
			} else if (filePath.startsWith('file://localhost/')) {
				filePath = filePath.substring(16);
			} else if (filePath.startsWith('file://')) {
				filePath = filePath.substring(7);
			}

			// URL 解码
			filePath = decodeURIComponent(filePath);

			// 尝试通过 Vault 读取
			const vaultFile = app.vault.getAbstractFileByPath(filePath);
			if (vaultFile instanceof TFile) {
				imgEl.src = app.vault.getResourcePath(vaultFile);
				this.setupImageEvents(imgEl, imageWrapper, app);
				return;
			}

			// Vault 外文件：使用 Node.js fs
			const { promises: fs } = await import('fs');
			const path = await import('path');

			await fs.access(filePath);
			const imageData = await fs.readFile(filePath);

			const ext = path.extname(filePath).toLowerCase();
			const mimeTypes: Record<string, string> = {
				'.png': 'image/png',
				'.jpg': 'image/jpeg',
				'.jpeg': 'image/jpeg',
				'.gif': 'image/gif',
				'.webp': 'image/webp',
				'.svg': 'image/svg+xml',
				'.bmp': 'image/bmp',
			};
			const mimeType = mimeTypes[ext] || 'image/png';
			const base64 = imageData.toString('base64');
			const dataUri = `data:${mimeType};base64,${base64}`;

			imgEl.src = dataUri;
			this.setupImageEvents(imgEl, imageWrapper, app);
		} catch (error) {
			console.error('[ImageRenderer] file:// URI 处理失败:', error);
			this.showError(imageWrapper);
		}
	}

	/**
	 * 设置图片事件监听器
	 */
	private static setupImageEvents(
		imgEl: HTMLImageElement,
		imageWrapper: HTMLElement,
		app: App,
	): void {
		imgEl.addClass('acp-image-loading');

		imgEl.addEventListener('load', () => {
			imgEl.removeClass('acp-image-loading');
			imgEl.addClass('acp-image-loaded');
		});

		imgEl.addEventListener('error', () => {
			this.showError(imageWrapper);
		});

		imgEl.addEventListener('click', () => {
			this.showPreview(imgEl.src, app);
		});
	}

	/**
	 * 显示图片错误占位符
	 */
	private static showError(imageWrapper: HTMLElement): void {
		imageWrapper.empty();
		const errorEl = imageWrapper.createDiv({ cls: 'acp-image-error-placeholder' });
		const iconEl = errorEl.createDiv({ cls: 'acp-image-error-icon' });
		setIcon(iconEl, 'image-off');
		errorEl.createDiv({ cls: 'acp-image-error-text', text: '图片加载失败' });
	}

	/**
	 * 显示图片预览
	 */
	private static showPreview(src: string, app: App): void {
		const modal = new ImagePreviewModal(app, src);
		modal.open();
	}
}

/**
 * 图片预览模态框
 */
class ImagePreviewModal extends Modal {
	private imageSrc: string;

	constructor(app: App, imageSrc: string) {
		super(app);
		this.imageSrc = imageSrc;
	}

	public onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('acp-image-preview-modal');

		const imgEl = contentEl.createEl('img', {
			cls: 'acp-image-preview',
			attr: { src: this.imageSrc, alt: '图片预览' },
		});

		imgEl.addEventListener('click', () => this.close());
		contentEl.addEventListener('click', (e) => {
			if (e.target === contentEl) this.close();
		});
	}

	public onClose(): void {
		this.contentEl.empty();
	}
}
