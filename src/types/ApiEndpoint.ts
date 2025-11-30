import * as TypesApiCommon from '../types/ApiCommon.js';

type AuthMeUser = {
  /**
   * is user logged in
   */
  loggedIn: boolean;
  /**
   * username
   */
  name?: string;
  /**
   * user group
   */
  group?: 'user' | string;
  email?: string;
  /**
   * UUIDv4 for recommender
   */
  recommenderUuid?: string;
};

/**
 * `/auth/me` auth status
 */
type RspAuthMeGet = {
  user: AuthMeUser;
  /**
   * is the auth system available
   */
  auth: boolean;
  /**
   * is registration available
   */
  reg: boolean;
};

/**
 * `/auth/reg` registration availability
 */
type RspAuthReg = {
  /**
   * is registration available
   */
  reg: boolean;
};

/**
 * `/auth/me` POST login req json body
 */
type ReqAuthMePost = { name: string; password: string };

/**
 * `/auth/me` POST login response
 */
type RspAuthMePost = {
  user: AuthMeUser;
  /**
   * JWT access token
   */
  token: string;
};

/**
 * `/works` response
 */
type RspWorks = {
  works: (TypesApiCommon.WorkInfoBase & { userRating: null | unknown })[];
  pagination: { currentPage: number; pageSize: number; totalCount: number };
};

/**
 * `/workInfo/:id` response
 */
type RspWorkInfo = TypesApiCommon.WorkInfoBase;
type RspWorkInfoSanitized = Omit<
  TypesApiCommon.WorkInfoBase,
  'samCoverUrl' | 'thumbnailCoverUrl' | 'mainCoverUrl' | 'circle_id' | 'name'
>;

export type { RspAuthMeGet, RspAuthReg, ReqAuthMePost, RspAuthMePost, RspWorks, RspWorkInfo, RspWorkInfoSanitized };
