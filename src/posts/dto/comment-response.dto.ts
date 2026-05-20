export interface CommentResponseDto {
	id: string;
	postId: string;
	authorId: string;
	parentId: string | null;
	content: string;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	author?: {
		id: string;
		email: string;
		profile?: {
			firstName: string | null;
			lastName: string | null;
		};
	};
}
