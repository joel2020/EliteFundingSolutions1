type PartnerApplicationBlockPolicy = {
  hasPartnerApplication: boolean;
  partnerApplicationReviewed: boolean;
  hasExistingCompletedApplication: boolean;
};

export function shouldBlockUnreviewedPartnerApplication(policy: PartnerApplicationBlockPolicy) {
  return policy.hasPartnerApplication
    && !policy.partnerApplicationReviewed
    && !policy.hasExistingCompletedApplication;
}
